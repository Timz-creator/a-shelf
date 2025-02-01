"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
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
import { useRouter } from "next/navigation";

// Move isValidConnection outside of fetchGraphData
const isValidConnection = (fromBook: any, toBook: any) => {
  // Only allow progression from beginner -> intermediate -> advanced
  if (fromBook.level === "beginner") {
    return toBook.level === "intermediate";
  }
  if (fromBook.level === "intermediate") {
    return toBook.level === "advanced";
  }
  // Don't allow advanced books to connect forward
  // Don't allow any backwards connections
  return false;
};

interface CustomNode extends Node {
  sourceConnections?: string[];
  targetConnections?: string[];
  data: {
    id: string;
    label: string;
    level: string;
    status: string;
    description: string;
    isAdvanced?: boolean;
    initiallyVisible?: boolean;
    onClick?: () => void;
  };
}

export default function KnowledgeGraph() {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<CustomNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [user, setUser] = useState<any>(null);
  const [currentTopic, setCurrentTopic] = useState<{
    topic_id: string;
    skill_level: string;
    status: string;
  } | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(5); // Start with 5 nodes
  const [selectedBook, setSelectedBook] = useState<BookNodeData | null>(null); // Track selected book
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );
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

        // Prepare layout
        const layout = {
          nodes: nodes.map((node) => ({
            id: node.id,
            type: "bookNode",
            position: node.position,
            data: {
              id: node.id,
              label: node.data.label,
              level: node.data.level,
              status: node.data.status,
              description: node.data.description,
              isAdvanced: node.data.level === "advanced",
              initiallyVisible: nodes.indexOf(node) < 3,
            },
          })),
          edges: Array.from(new Set(edges.map((e) => JSON.stringify(e))))
            .map((e) => JSON.parse(e))
            .map((edge) => ({
              id: edge.id,
              source: edge.source,
              target: edge.target,
              type: "bezier",
              animated: true,
              sourceLevel: nodes.find((n) => n.id === edge.source)?.data.level,
              targetLevel: nodes.find((n) => n.id === edge.target)?.data.level,
            })),
          expandedNodes,
          visibleCount,
          lastSaved: new Date().toISOString(),
        };

        // Validate layout
        if (!layout || typeof layout !== "object") {
          console.error("Invalid layout data:", layout);
          setSaveStatus("error");
          return;
        }

        // Save to Supabase
        const { data, error } = await supabase.from("User_Graph").upsert(
          {
            user_id: user.id,
            topic_id: currentTopic.topic_id,
            graph_layout: layout,
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
  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      saveGraphLayout(); // Save when nodes move
    },
    [saveGraphLayout]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      saveGraphLayout(); // Save when edges change
    },
    [saveGraphLayout]
  );

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge(params, eds));
      saveGraphLayout(); // Save when new connections are made
    },
    [saveGraphLayout]
  );

  // Add node click handler
  const onNodeClick = useCallback(
    (event: any, node: Node) => {
      setExpandedNodes((prev) => {
        const isExpanded = prev.includes(node.id);
        const newExpanded = isExpanded
          ? prev.filter((id) => id !== node.id)
          : [...prev, node.id];
        saveGraphLayout(); // Save when nodes expand/collapse
        return newExpanded;
      });
    },
    [saveGraphLayout]
  );

  // Update the handleShowMore function
  const handleShowMore = useCallback(() => {
    setExpandedNodes((prev) => {
      const currentlyShown = new Set(prev);
      const nextNodes = nodes
        .filter((node) => !currentlyShown.has(node.id))
        .slice(0, 3)
        .map((node) => node.id);
      const newExpanded = [...prev, ...nextNodes];
      saveGraphLayout(); // Save when more nodes are shown
      return newExpanded;
    });
    setVisibleCount((prev) => Math.min(prev + 3, nodes.length));
  }, [nodes, saveGraphLayout]);

  const fetchGraphData = async () => {
    try {
      setLoading(true);
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
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false });

      console.log("4. User topics:", userTopics);

      if (!userTopics || userTopics.length === 0) {
        throw new Error("No topics selected");
      }

      const mostRecentTopic = userTopics[0];
      setCurrentTopic(mostRecentTopic);

      const { data: books } = await supabase
        .from("Books")
        .select("*")
        .eq("topic_id", mostRecentTopic.topic_id);

      console.log("5. Books found:", books?.length);

      if (!books) throw new Error("No books found");

      // Analyze books if no connections exist
      if (books.length > 0) {
        try {
          await analyzeBooks(books, mostRecentTopic);
        } catch (error) {
          console.error("Failed to analyze books:", error);
        }
      }

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
          expandedNodes
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

        // Calculate position with horizontal spacing
        const calculatePosition = (
          level: string,
          index: number,
          totalInLevel: number
        ) => {
          const CANVAS_WIDTH = 800; // Total width available
          const spacing = CANVAS_WIDTH / (totalInLevel + 1); // Even spacing
          const x = spacing * (index + 1); // Position based on index

          // Vertical position based on level
          const y =
            level === "beginner" ? 100 : level === "intermediate" ? 300 : 500;

          return { x, y };
        };

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
            const nodeData = {
              id: book.google_books_id,
              type: "bookNode",
              data: {
                id: book.google_books_id,
                label: book.title,
                level: book.level as "beginner" | "intermediate" | "advanced",
                status: book.status || "not_started",
                isAdvanced: book.level === "advanced",
                description: book.description,
                initiallyVisible: index < 3, // First 3 nodes are visible
                onClick: () =>
                  setSelectedBook({
                    id: book.google_books_id,
                    title: book.title,
                    description: book.description,
                    isAdvanced: book.level === "advanced",
                    status: book.status || "not_started",
                  }),
              },
              position: calculatePosition(level, index, books.length),
              sourceConnections: books
                .filter((b) => isValidConnection(book, b))
                .map((b) => b.google_books_id),
              targetConnections: books
                .filter((b) => isValidConnection(b, book))
                .map((b) => b.google_books_id),
            };

            console.log("Node data:", nodeData);
            return nodeData;
          });
        });

        // Create edges from valid connections
        const edges = visibleData.connections.map((conn) => {
          console.log("Creating edge for connection:", conn);
          return {
            id: `${conn.from_book_id}-${conn.to_book_id}`,
            source: conn.from_book_id,
            target: conn.to_book_id,
            animated: true,
            type: "bezier",
          };
        });

        setNodes(nodes);
        setEdges(edges);
      }
    } catch (error) {
      console.error("Error in fetchGraphData:", error);
    } finally {
      setLoading(false);
    }
  };

  // Update useEffect to run when expandedNodes changes
  useEffect(() => {
    console.log("Fetching graph data. Expanded nodes:", expandedNodes);
    fetchGraphData();
  }, [expandedNodes]); // Add expandedNodes to dependencies

  console.log("Rendering with:", {
    nodesLength: nodes.length,
    edgesLength: edges.length,
    loading,
  });

  // Update filterInitialNodes to handle progressive reveal
  const filterInitialNodes = (
    books: any[],
    userLevel: string,
    connections: any[],
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

  // Update getVisibleNodes to handle connections
  const getVisibleNodes = (
    books: any[],
    userLevel: string,
    connections: any[],
    expandedNodeIds: string[]
  ) => {
    console.log("getVisibleNodes input:", {
      totalBooks: books.length,
      userLevel,
      totalConnections: connections.length,
      expandedNodeIds,
    });

    const visibleBooks = filterInitialNodes(
      books,
      userLevel,
      connections,
      expandedNodeIds.length + 3
    );

    console.log("After filterInitialNodes:", {
      visibleBooks: visibleBooks.length,
      bookLevels: visibleBooks.map((b) => b.level),
    });

    const visibleBookIds = visibleBooks.map((b) => b.google_books_id);
    const validConnections = connections.filter((conn) => {
      const isVisible =
        visibleBookIds.includes(conn.from_book_id) &&
        visibleBookIds.includes(conn.to_book_id);

      console.log("Connection check:", {
        connection: conn,
        isVisible,
        fromBookExists: visibleBookIds.includes(conn.from_book_id),
        toBookExists: visibleBookIds.includes(conn.to_book_id),
      });

      if (!isVisible) return false;

      const fromBook = books.find(
        (b) => b.google_books_id === conn.from_book_id
      );
      const toBook = books.find((b) => b.google_books_id === conn.to_book_id);

      const isValid = isValidConnection(fromBook, toBook);
      console.log("Connection validation:", {
        fromBook: fromBook?.title,
        toBook: toBook?.title,
        isValid,
      });

      return isValid;
    });

    console.log("Final output:", {
      visibleBooks: visibleBooks.length,
      validConnections: validConnections.length,
    });

    console.log("Valid connections after filtering:", validConnections);

    return {
      books: visibleBooks,
      connections: validConnections,
    };
  };

  const analyzeBooks = async (books: any[], topic: any) => {
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
                Showing {Math.min(visibleCount, nodes.length)} of {nodes.length}{" "}
                books
              </CardDescription>
            </div>
            <Button
              onClick={handleShowMore}
              className="bg-black text-white font-medium"
              disabled={expandedNodes.length >= nodes.length}
            >
              Show More
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] p-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              Loading graph data...
            </div>
          ) : (
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
              <Background color="#f0f0f0" variant="dots" />
              <Controls />
            </ReactFlow>
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
