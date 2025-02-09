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
import debounce from "lodash/debounce";
import { useToast } from "@/hooks/use-toast";
import { get } from "lodash";
import { useRouter } from "next/navigation";

interface PageProps {
  params: {
    topicId: string;
  };
}

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

export default function KnowledgeGraph({ params }: PageProps) {
  const { topicId } = params;
  console.log("KnowledgeGraph mounted with topicId:", topicId);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<CustomNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);
  const [selectedBook, setSelectedBook] = useState<BookNodeData | null>(null);
  const [allBooksLoaded, setAllBooksLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );
  const supabase = createClientComponentClient();
  const { toast } = useToast();
  const router = useRouter();
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const [unanalyzedBooks, setUnanalyzedBooks] = useState<string[]>([]);
  const [partialGraph, setPartialGraph] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [previewNodes, setPreviewNodes] = useState<CustomNode[]>([]);

  const filterInitialNodes = useCallback(
    (
      books: any[],
      userLevel: string,
      connections: any[],
      showCount: number
    ) => {
      const booksByLevel = {
        beginner: books.filter((b) => b.level === "beginner"),
        intermediate: books.filter((b) => b.level === "intermediate"),
        advanced: books.filter((b) => b.level === "advanced"),
      };

      const initialSet = (() => {
        switch (userLevel) {
          case "beginner":
            return {
              beginner: 2,
              intermediate: 1,
              advanced: 0,
            };
          case "intermediate":
            return {
              beginner: 2,
              intermediate: 2,
              advanced: 1,
            };
          case "advanced":
            return {
              beginner: 0,
              intermediate: 2,
              advanced: 2,
            };
          default:
            return { beginner: 0, intermediate: 0, advanced: 0 };
        }
      })();

      let selectedBooks = [
        ...booksByLevel.beginner.slice(0, initialSet.beginner),
        ...booksByLevel.intermediate.slice(0, initialSet.intermediate),
        ...booksByLevel.advanced.slice(0, initialSet.advanced),
      ];

      if (showCount > selectedBooks.length) {
        const remainingCount = showCount - selectedBooks.length;
        const selectedIds = new Set(
          selectedBooks.map((b) => b.google_books_id)
        );
        const additionalBooks = books
          .filter((b) => !selectedIds.has(b.google_books_id))
          .slice(0, remainingCount);
        selectedBooks = [...selectedBooks, ...additionalBooks];
      }

      return selectedBooks;
    },
    []
  );

  const saveGraphLayout = useCallback(
    debounce(async () => {
      try {
        setSaveStatus("saving");
        console.log("Preparing to save layout:", {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          expandedNodes,
          visibleCount,
        });

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
          edges: edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: "bezier",
          })),
          previewNodes: previewNodes.map((node) => ({
            id: node.id,
            type: "previewNode",
            position: node.position,
            data: node.data,
          })),
          expandedNodes,
          visibleCount,
          lastSaved: new Date().toISOString(),
        };

        console.log("Saving layout to Supabase:", {
          topic_id: topicId,
          layout: {
            nodes: layout.nodes.length,
            edges: layout.edges.length,
            sample_edge: layout.edges[0],
            sample_node: layout.nodes[0],
          },
        });

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        await supabase.from("User_Graph").upsert(
          {
            user_id: user.id,
            topic_id: topicId,
            graph_layout: layout,
          },
          { onConflict: "user_id,topic_id" }
        );

        setSaveStatus("saved");
        toast({ description: "Graph layout saved" });
      } catch (error) {
        console.error("Save error details:", error);
        setSaveStatus("error");
        toast({
          description: "Failed to save graph layout",
          variant: "destructive",
        });
      }
    }, 1000),
    [nodes, edges, expandedNodes, visibleCount, topicId, previewNodes]
  );

  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setPartialGraph(false);
      console.log("Fetching data for topic:", topicId);

      // Get authenticated user for loading their progress
      // This is needed to fetch the correct progress data for this user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      // 1. Try to get saved layout
      const { data: savedLayout } = await supabase
        .from("User_Graph")
        .select("graph_layout")
        .eq("topic_id", topicId)
        .single();

      console.log("Saved layout found:", !!savedLayout?.graph_layout);

      if (savedLayout?.graph_layout) {
        const restoredNodes = savedLayout.graph_layout.nodes.map((node) => ({
          ...node,
          type: "bookNode",
          data: {
            ...node.data,
            level: node.data.level,
            status: node.data.status,
            isAdvanced: node.data.level === "advanced",
            onClick: () =>
              setSelectedBook({
                id: node.data.id,
                title: node.data.label,
                description: node.data.description,
                status: node.data.status || "not_started",
              }),
          },
          hidden:
            !node.data.initiallyVisible &&
            !savedLayout.graph_layout.expandedNodes.includes(node.id),
        }));

        const restoredEdges = savedLayout.graph_layout.edges
          .filter(
            (edge, index, self) =>
              index ===
              self.findIndex(
                (e) => e.source === edge.source && e.target === edge.target
              )
          )
          .map((edge) => ({
            ...edge,
            type: "bezier",
            animated: true,
            hidden: restoredNodes.some(
              (n) => (n.id === edge.source || n.id === edge.target) && n.hidden
            ),
          }));

        setNodes(restoredNodes);
        setEdges(restoredEdges);
        setExpandedNodes(savedLayout.graph_layout.expandedNodes);
        setVisibleCount(savedLayout.graph_layout.visibleCount);

        // Restore preview nodes if they exist
        if (savedLayout.graph_layout.previewNodes) {
          const restoredPreviews = savedLayout.graph_layout.previewNodes.map(
            (node) => ({
              ...node,
              data: {
                ...node.data,
                status: node.data.status || "not_started",
              },
            })
          );
          setPreviewNodes(restoredPreviews);
        }
        return;
      }

      // 2. If no saved layout, fetch initial data
      const { data: topic } = await supabase
        .from("Topics")
        .select("*")
        .eq("id", topicId)
        .single();

      if (!topic) {
        throw new Error("Topic not found");
      }

      const { data: books } = await supabase
        .from("Books")
        .select("*")
        .eq("topic_id", topicId)
        .order("level");

      // Get connections between books
      const { data: connections } = await supabase
        .from("Skill_Map")
        .select("*")
        .eq("topic_id", topicId);

      console.log("Books query result:", {
        found: !!books?.length,
        count: books?.length,
        topicId,
      });

      if (!books?.length) {
        toast({
          description: "No books found for this topic",
          variant: "destructive",
        });
        router.push("/dashboard");
        return;
      }

      // Load all progress entries for this user's books
      // This gets the saved status (not_started/in_progress/completed) for each book
      const { data: userProgress } = await supabase
        .from("User_Progress")
        .select("*")
        .eq("user_id", user.id)
        .in(
          "book_id",
          books.map((b) => b.google_books_id)
        );

      // Check for unanalyzed books
      const unanalyzedBookIds = books
        .filter((book) => !book.analyzed)
        .map((book) => book.google_books_id);

      setUnanalyzedBooks(unanalyzedBookIds);

      if (unanalyzedBookIds.length > 0) {
        setPartialGraph(true);
        setAnalysisInProgress(true);
        // Trigger background analysis
        analyzeBooks(books, topic).catch(console.error);
      }

      // Get user's level for the topic
      const { data: userTopic } = await supabase
        .from("User_Topics")
        .select("skill_level")
        .eq("topic_id", topicId)
        .single();

      const userLevel = userTopic?.skill_level || "beginner";

      // Get visible books and create preview nodes
      const { books: visibleBooks, connections: validConnections } =
        getVisibleNodes(books, userLevel, connections || [], []);

      // Create nodes from visible books
      const initialNodes = visibleBooks.map((book, index) => ({
        id: book.google_books_id,
        type: "bookNode",
        position: calculatePosition(book.level, index, books.length),
        data: {
          id: book.google_books_id,
          label: book.title,
          level: book.level,
          // Apply saved progress status from database, fallback to not_started if none found
          status:
            userProgress?.find((p) => p.book_id === book.google_books_id)
              ?.status || "not_started",
          description: book.description,
          onClick: () =>
            setSelectedBook({
              id: book.google_books_id,
              title: book.title,
              description: book.description,
              // Also update the selected book view with saved progress
              status:
                userProgress?.find((p) => p.book_id === book.google_books_id)
                  ?.status || "not_started",
            }),
        },
      }));

      // Create edges from valid connections
      const initialEdges = validConnections.map((conn) => ({
        id: `${conn.from_book_id}-${conn.to_book_id}`,
        source: conn.from_book_id,
        target: conn.to_book_id,
        type: "bezier",
        animated: true,
      }));

      setNodes(initialNodes);
      setEdges(initialEdges);
      setAllBooksLoaded(true);
    } catch (error) {
      console.error("Error in fetchGraphData:", error);
      toast({
        description: "Error loading graph",
        variant: "destructive",
      });
      router.push("/dashboard");
    } finally {
      setLoading(false);
      setLastUpdateTime(new Date());
    }
  }, [topicId, getVisibleNodes, router, toast, supabase]);

  const handleShowMore = useCallback(() => {
    setExpandedNodes((prev) => {
      const currentlyShown = new Set(prev);
      const nextNodes = previewNodes
        .filter((node) => !currentlyShown.has(node.data.id))
        .slice(0, 3)
        .map((node) => node.data.id);

      const newExpanded = [...prev, ...nextNodes];
      saveGraphLayout();
      setVisibleCount((prev) => Math.min(prev + 3, nodes.length));

      // Remove used preview nodes
      setPreviewNodes((prev) => prev.slice(3));

      return newExpanded;
    });
  }, [previewNodes, nodes.length, saveGraphLayout]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      saveGraphLayout();
    },
    [saveGraphLayout]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      saveGraphLayout();
    },
    [saveGraphLayout]
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onNodeClick = useCallback(
    (event: any, node: Node) => {
      setExpandedNodes((prev) => {
        const isExpanded = prev.includes(node.id);
        const newExpanded = isExpanded
          ? prev.filter((id) => id !== node.id)
          : [...prev, node.id];
        saveGraphLayout();
        return newExpanded;
      });
    },
    [saveGraphLayout]
  );

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
                type: "bezier",
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

  // Add calculatePosition
  const calculatePosition = useCallback(
    (level: string, index: number, totalInLevel: number, isPreview = false) => {
      const CANVAS_WIDTH = 800;
      const spacing = CANVAS_WIDTH / (totalInLevel + 1);
      const x = spacing * (index + 1);
      let y = level === "beginner" ? 100 : level === "intermediate" ? 300 : 500;
      if (isPreview) y += 200;
      return { x, y };
    },
    []
  );

  // Move isValidConnection inside
  const isValidConnection = useCallback((fromBook: any, toBook: any) => {
    if (fromBook.level === "beginner") {
      return toBook.level === "intermediate";
    }
    if (fromBook.level === "intermediate") {
      return toBook.level === "advanced";
    }
    return false;
  }, []);

  // Move getVisibleNodes inside and make it useCallback
  const getVisibleNodes = useCallback(
    (
      books: any[],
      userLevel: string,
      connections: any[],
      expandedNodeIds: string[]
    ) => {
      const visibleBooks = filterInitialNodes(
        books,
        userLevel,
        connections,
        expandedNodeIds.length + 3
      );

      // Filter valid connections
      const visibleBookIds = visibleBooks.map((b) => b.google_books_id);
      const validConnections = connections.filter((conn) => {
        const isVisible =
          visibleBookIds.includes(conn.from_book_id) &&
          visibleBookIds.includes(conn.to_book_id);

        if (!isVisible) return false;

        const fromBook = books.find(
          (b) => b.google_books_id === conn.from_book_id
        );
        const toBook = books.find((b) => b.google_books_id === conn.to_book_id);

        return isValidConnection(fromBook, toBook);
      });

      // Create preview nodes
      const previewBooks = books
        .filter((book) => !visibleBooks.includes(book))
        .slice(0, 2)
        .map((book, index) => ({
          id: `preview-${book.google_books_id}`,
          type: "previewNode",
          position: calculatePosition(book.level, index, 2, true),
          data: {
            id: book.google_books_id,
            label: book.title,
            level: book.level,
            status: "not_started",
            description: book.description,
            isAdvanced: book.level === "advanced",
            initiallyVisible: false,
          },
        }));

      setPreviewNodes(previewBooks);
      return {
        books: visibleBooks,
        connections: validConnections,
      };
    },
    [setPreviewNodes, filterInitialNodes, calculatePosition, isValidConnection]
  );

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
            <Button
              onClick={handleShowMore}
              className="bg-black text-white font-medium"
              disabled={expandedNodes.length >= nodes.length || loading}
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

      <BookSidebar
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
        onStatusChange={(id, status) => {
          setNodes((prevNodes) => {
            const newNodes = prevNodes.map((node) => {
              if (node.id === id) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    status,
                  },
                };
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
