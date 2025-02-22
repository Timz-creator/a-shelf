"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  NodeChange,
  EdgeChange,
  Connection as FlowConnection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  BackgroundVariant,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookSidebar } from "@/app/components/graph/BookSidebar";
import { nodeTypes } from "@/app/components/graph/nodeTypes";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";
import debounce from "lodash/debounce";

interface Book {
  google_books_id: string;
  title: string;
  level: "beginner" | "intermediate" | "advanced";
  status?: ProgressStatus["status"];
  description: string;
  analyzed: boolean;
  topic_id: string;
}

interface BookNodeData {
  id: string;
  title: string;
  description: string;
  isAdvanced: boolean;
  status: ProgressStatus["status"];
}

interface User {
  id: string;
  email?: string;
}

interface Connection {
  from_book_id: string;
  to_book_id: string;
}

interface ProgressStatus {
  status: "not_started" | "in_progress" | "completed";
}

interface CustomNodeChange extends NodeChange {
  id: string;
}

interface CustomEdgeChange extends EdgeChange {
  id: string;
  item?: Edge;
}

interface CustomConnectParams extends Connection {
  id: string;
}

// Move isValidConnection outside of fetchGraphData
const isValidConnection = (fromBook: Book, toBook: Book): boolean => {
  if (!fromBook || !toBook) return false;

  if (fromBook.level === "beginner") {
    return toBook.level === "intermediate";
  }
  if (fromBook.level === "intermediate") {
    return toBook.level === "advanced";
  }
  return false;
};

interface CustomNode extends Node {
  sourceConnections?: string[];
  targetConnections?: string[];
  data: {
    id: string;
    label: string;
    level: string;
    status: ProgressStatus["status"];
    description: string;
    isAdvanced?: boolean;
    initiallyVisible?: boolean;
    onClick?: () => void;
  };
}

const calculatePosition = (
  level: string,
  index: number,
  totalInLevel: number,
  isPreview = false
) => {
  const CANVAS_HEIGHT = 600;
  const spacing = CANVAS_HEIGHT / (totalInLevel + 1);
  const y = spacing * (index + 1);
  // Position nodes horizontally based on level
  let x = level === "beginner" ? 100 : level === "intermediate" ? 400 : 700;
  if (isPreview) x += 200;
  return { x, y };
};

interface VisibleNodesResult {
  books: Book[];
  connections: Connection[];
}

interface TopicData {
  topic_id: string;
  skill_level: string;
  status: string;
}

export default function KnowledgeGraph() {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<CustomNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [currentTopic, setCurrentTopic] = useState<{
    topic_id: string;
    skill_level: string;
    status: string;
  } | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const [selectedBook, setSelectedBook] = useState<BookNodeData | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const [unanalyzedBooks, setUnanalyzedBooks] = useState<string[]>([]);
  const [partialGraph, setPartialGraph] = useState(false);
  const supabase = createClientComponentClient();

  // Get user on mount
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase]);

  // Optimistically save graph layout with debouncing
  const saveGraphLayout = useCallback(
    debounce(async () => {
      try {
        setSaveStatus("saving");

        // Validate required fields
        if (!user?.id || !currentTopic?.topic_id) {
          console.error("Missing required fields:", {
            user_id: user?.id,
            topic_id: currentTopic?.topic_id,
          });
          setSaveStatus("error");
          return;
        }

        // Save only positions and state
        const nodePositions = nodes.reduce(
          (acc, node) => ({
            ...acc,
            [node.id]: node.position,
          }),
          {}
        );

        // Save to Supabase
        const { error } = await supabase.from("User_Graph").upsert(
          {
            user_id: user.id,
            topic_id: currentTopic.topic_id,
            node_positions: nodePositions,
            expanded_nodes: expandedNodes,
            visible_count: visibleCount,
          },
          { onConflict: "user_id,topic_id" }
        );

        if (error) {
          console.error("Supabase Error Details:", error);
          setSaveStatus("error");
          toast({
            description:
              "Failed to save layout. Changes will be lost on refresh.",
            variant: "destructive",
          });
        } else {
          setSaveStatus("saved");
          toast({ description: "Graph layout saved" });
        }
      } catch (error) {
        console.error("Save Error:", error);
        setSaveStatus("error");
      }
    }, 1000),
    [nodes, edges, expandedNodes, visibleCount, currentTopic, user]
  );

  // Update existing callbacks to save layout
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes(
        (nds: CustomNode[]) => applyNodeChanges(changes, nds) as CustomNode[]
      );
      saveGraphLayout();
    },
    [saveGraphLayout]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      saveGraphLayout();
    },
    [saveGraphLayout]
  );

  const onConnect: OnConnect = useCallback(
    (params: FlowConnection) => {
      setEdges((eds) => addEdge(params, eds));
      saveGraphLayout();
    },
    [saveGraphLayout]
  );

  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setPartialGraph(false);
      console.log("1. Starting fetchGraphData");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("2. Session check:", !!session);

      if (!session) {
        throw new Error("No session found");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("3. User found:", !!user);

      const { data: userTopics } = await supabase
        .from("User_Topics")
        .select("topic_id, status, skill_level")
        .eq("user_id", user?.id ?? "")
        .eq("status", "in_progress")
        .order("created_at", { ascending: false });

      console.log("4. User topics:", userTopics);

      if (!userTopics || userTopics.length === 0) {
        throw new Error("No topics selected");
      }

      const mostRecentTopic = userTopics[0];
      setCurrentTopic(mostRecentTopic);

      // Get saved graph data if it exists
      const { data: savedGraph } = await supabase
        .from("User_Graph")
        .select("node_positions, expanded_nodes, visible_count")
        .eq("user_id", user?.id ?? "")
        .eq("topic_id", mostRecentTopic.topic_id)
        .single();

      const { data: books } = await supabase
        .from("Books")
        .select("*")
        .eq("topic_id", mostRecentTopic.topic_id);

      console.log("5. Books found:", books?.length);

      if (!books) throw new Error("No books found");

      // Check for unanalyzed books
      const unanalyzedBookIds = books
        .filter((book) => !book.analyzed)
        .map((book) => book.google_books_id);

      setUnanalyzedBooks(unanalyzedBookIds);

      if (unanalyzedBookIds.length > 0) {
        setPartialGraph(true);
        setAnalysisInProgress(true);
        // Trigger background analysis
        analyzeBooks(books, mostRecentTopic).catch(console.error);
      }

      // Load existing connections
      const { data: connections } = await supabase
        .from("Skill_Map")
        .select("*")
        .in(
          "from_book_id",
          books.map((b) => b.google_books_id)
        )
        .in(
          "to_book_id",
          books.map((b) => b.google_books_id)
        );

      console.log("6. Connections found:", connections?.length);

      if (books && connections) {
        const visibleData = getVisibleNodes(
          books,
          mostRecentTopic.skill_level,
          connections,
          // Use saved expanded nodes if they exist
          savedGraph?.expanded_nodes || expandedNodes
        );

        // Log initial books and connections
        console.log("Initial Data:", {
          visibleBooks: visibleData.books.map((b) => ({
            id: b.google_books_id,
            title: b.title,
            level: b.level,
          })),
          connections: connections?.map((c) => ({
            from: c.from_book_id,
            to: c.to_book_id,
          })),
        });

        // Create nodes with positions
        const nodesByLevel = {
          beginner: visibleData.books.filter((b) => b.level === "beginner"),
          intermediate: visibleData.books.filter(
            (b) => b.level === "intermediate"
          ),
          advanced: visibleData.books.filter((b) => b.level === "advanced"),
        };

        // Before node creation
        console.log("Creating nodes with books:", books);

        const nodes = Object.entries(nodesByLevel).flatMap(([level, books]) => {
          console.log(`Creating ${level} nodes:`, books);

          return books.map((book, index) => {
            const position =
              savedGraph?.node_positions?.[book.google_books_id] ||
              calculatePosition(level, index, books.length);

            return {
              id: book.google_books_id,
              type: "bookNode",
              sourcePosition: "right",
              targetPosition: "left",
              data: {
                id: book.google_books_id,
                label: book.title,
                level: book.level as "beginner" | "intermediate" | "advanced",
                status: book.status || "not_started",
                isAdvanced: book.level === "advanced",
                description: book.description,
                onClick: () =>
                  setSelectedBook({
                    id: book.google_books_id,
                    title: book.title,
                    description: book.description,
                    isAdvanced: book.level === "advanced",
                    status: book.status || "not_started",
                  }),
              },
              position,
              sourceConnections: books
                .filter((b) => isValidConnection(book, b))
                .map((b) => b.google_books_id),
              targetConnections: books
                .filter((b) => isValidConnection(b, book))
                .map((b) => b.google_books_id),
            };
          });
        });

        // Create edges from valid connections
        const edges = visibleData.connections.map((conn: Connection) => ({
          id: `${conn.from_book_id}-${conn.to_book_id}`,
          source: conn.from_book_id,
          target: conn.to_book_id,
          animated: true,
          type: "smoothstep",
        }));

        setNodes(nodes);
        setEdges(edges);
        // Restore saved state
        if (savedGraph) {
          if (!expandedNodes.length) {
            const savedExpandedNodes = savedGraph.expanded_nodes;
            const savedVisibleCount = savedGraph.visible_count;

            // Calculate preview nodes based on saved state
            const visibleData = getVisibleNodes(
              books,
              mostRecentTopic.skill_level,
              connections,
              savedExpandedNodes
            );

            setExpandedNodes(savedExpandedNodes);
            setVisibleCount(savedVisibleCount);
          }
        }
      }
    } catch (error) {
      console.error("Error in fetchGraphData:", error);
    } finally {
      setLoading(false);
    }
  }, [
    supabase,
    setCurrentTopic,
    setNodes,
    setEdges,
    setExpandedNodes,
    setVisibleCount,
  ]);

  // Update useEffect to run when user is available
  useEffect(() => {
    console.log("Fetching graph data. Expanded nodes:", expandedNodes);
    if (user) {
      fetchGraphData();
    }
  }, [user, fetchGraphData]); // Only depend on user and fetchGraphData

  // Add polling for analysis updates
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (analysisInProgress && unanalyzedBooks.length > 0) {
      pollInterval = setInterval(async () => {
        // Check for newly analyzed books
        const { data: analyzedBooks } = await supabase
          .from("Books")
          .select("google_books_id")
          .in("google_books_id", unanalyzedBooks)
          .eq("analyzed", true);

        if (analyzedBooks && analyzedBooks.length > 0) {
          // Get new connections for analyzed books
          const { data: newConnections } = await supabase
            .from("Skill_Map")
            .select("*")
            .in(
              "from_book_id",
              analyzedBooks.map((b) => b.google_books_id)
            )
            .in(
              "to_book_id",
              analyzedBooks.map((b) => b.google_books_id)
            );

          // Update edges without re-fetching everything
          if (newConnections) {
            setEdges((currentEdges) => {
              const newEdges = newConnections.map((conn) => ({
                id: `${conn.from_book_id}-${conn.to_book_id}`,
                source: conn.from_book_id,
                target: conn.to_book_id,
                animated: true,
                type: "smoothstep",
              }));
              return [...currentEdges, ...newEdges];
            });
          }
        }

        // Stop polling if all books are analyzed
        if (analyzedBooks?.length === unanalyzedBooks.length) {
          setAnalysisInProgress(false);
          setPartialGraph(false);
        }
      }, 5000);
    }

    return () => clearInterval(pollInterval);
  }, [analysisInProgress, unanalyzedBooks]);

  // Add state verification logging
  useEffect(() => {
    console.log("Graph State Verification:", {
      totalNodes: nodes.length,
      visibleCount,
      expandedNodesCount: expandedNodes.length,
      saveStatus,
      analysisInProgress,
      unanalyzedBooksCount: unanalyzedBooks.length,
      partialGraph,
    });
  }, [
    nodes.length,
    visibleCount,
    expandedNodes,
    saveStatus,
    analysisInProgress,
    unanalyzedBooks,
    partialGraph,
  ]);

  console.log("Rendering with:", {
    nodesLength: nodes.length,
    edgesLength: edges.length,
    loading,
  });

  // Update filterInitialNodes to handle progressive reveal
  const filterInitialNodes = (
    books: Book[],
    userLevel: string,
    connections: Connection[],
    showCount: number = 5
  ) => {
    // Group books by level
    const booksByLevel = {
      beginner: books.filter((b) => b.level === "beginner"),
      intermediate: books.filter((b) => b.level === "intermediate"),
      advanced: books.filter((b) => b.level === "advanced"),
    };

    // Get initial set based on user level
    const initialSet = (() => {
      switch (userLevel) {
        case "beginner":
          return {
            beginner: 2, // Show 2 beginner books
            intermediate: 1, // Preview 1 intermediate
            advanced: 0,
          };
        case "intermediate":
          return {
            beginner: 2, // Show 2 prereqs
            intermediate: 2, // Show 2 current level
            advanced: 1, // Preview 1 advanced
          };
        case "advanced":
          return {
            beginner: 0,
            intermediate: 2, // Show 2 prereqs
            advanced: 2, // Show 2 advanced
          };
        default:
          return { beginner: 0, intermediate: 0, advanced: 0 };
      }
    })();

    // Get initial books
    let selectedBooks = [
      ...booksByLevel.beginner.slice(0, initialSet.beginner),
      ...booksByLevel.intermediate.slice(0, initialSet.intermediate),
      ...booksByLevel.advanced.slice(0, initialSet.advanced),
    ];

    // Add more books if showCount is higher
    if (showCount > selectedBooks.length) {
      const remainingCount = showCount - selectedBooks.length;
      const selectedIds = new Set(selectedBooks.map((b) => b.google_books_id));

      // Add books in level order
      const additionalBooks = books
        .filter((b) => !selectedIds.has(b.google_books_id))
        .slice(0, remainingCount);

      selectedBooks = [...selectedBooks, ...additionalBooks];
    }

    return selectedBooks;
  };

  // Update getVisibleNodes to handle connections and previews
  const getVisibleNodes = useCallback(
    (
      books: Book[],
      userLevel: string,
      connections: Connection[],
      expandedNodeIds: string[]
    ): VisibleNodesResult => {
      console.log("GetVisibleNodes Input:", {
        booksCount: books.length,
        userLevel,
        connectionsCount: connections.length,
        expandedNodeIds,
      });

      const visibleBooks = books.filter(
        (book) =>
          expandedNodeIds.includes(book.google_books_id) ||
          expandedNodeIds.length < 3
      );

      console.log("GetVisibleNodes Output:", {
        visibleBooksCount: visibleBooks.length,
        expandedNodesCount: expandedNodeIds.length,
      });

      return {
        books: visibleBooks,
        connections: connections.filter(
          (conn) =>
            visibleBooks.some(
              (book) => book.google_books_id === conn.from_book_id
            ) &&
            visibleBooks.some(
              (book) => book.google_books_id === conn.to_book_id
            )
        ),
      };
    },
    []
  );

  const analyzeBooks = async (books: Book[], topic: TopicData) => {
    console.log("Attempting to analyze books:", {
      booksCount: books.length,
      topic,
      endpoint: "/api/analyze-books",
    });

    try {
      const response = await fetch("/api/analyze-books", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ books, topic }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Analyze books failed:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(`Failed to analyze books: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Analysis complete:", data);
      return data;
    } catch (error) {
      console.error("Error in analyzeBooks:", error);
      throw error;
    }
  };

  return (
    <div className="p-4 w-full min-h-screen">
      <Button
        variant="ghost"
        className="mb-6 px-0 hover:bg-transparent"
        asChild
      >
        <Link
          href="/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-black"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back to Dashboard
        </Link>
      </Button>
      <Card className="w-full h-[800px]">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="font-semibold">Knowledge Graph</CardTitle>
              <CardDescription className="font-medium">
                {partialGraph
                  ? `Analyzing books... ${
                      nodes.length - unanalyzedBooks.length
                    } of ${nodes.length} complete`
                  : `Showing ${Math.min(visibleCount, nodes.length)} of ${
                      nodes.length
                    } books`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] p-0 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              Loading graph data...
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-500 mb-4">
                No books found for this topic
              </p>
              <Button
                onClick={() => fetchGraphData()}
                className="bg-black text-white"
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                style={{ width: "100%", height: "100%" }}
              >
                <Background color="#f0f0f0" variant={BackgroundVariant.Dots} />
                <Controls />
              </ReactFlow>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add BookSidebar */}
      <BookSidebar
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
        onStatusChange={(id, status) => {
          console.log("Status update triggered:", { id, status });
          console.log("All nodes:", nodes);

          setNodes((prevNodes) => {
            const newNodes = prevNodes.map((node) => {
              console.log("Checking node:", node.id, "against:", id);
              if (node.id === id) {
                console.log("Updating node:", node.id);
                console.log("Before update:", node.data);

                // Update the book status in Supabase
                supabase
                  .from("User_Progress")
                  .upsert(
                    {
                      user_id: user?.id,
                      book_id: id,
                      status: status,
                    },
                    {
                      onConflict: "user_id,book_id",
                    }
                  )
                  .then(({ error }) => {
                    if (error) {
                      console.error("Error updating book status:", error);
                      toast({
                        description: "Failed to update book status",
                        variant: "destructive",
                      });
                    }
                  });

                const updatedNode = {
                  ...node,
                  data: {
                    ...node.data,
                    status,
                  },
                };

                console.log("After update:", updatedNode.data);
                return updatedNode;
              }
              return node;
            });

            return newNodes;
          });
        }}
      />
    </div>
  );
}
