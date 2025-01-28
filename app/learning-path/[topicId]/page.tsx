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

const isValidConnection = (fromBook: any, toBook: any) => {
  if (fromBook.level === "beginner") {
    return toBook.level === "intermediate";
  }
  if (fromBook.level === "intermediate") {
    return toBook.level === "advanced";
  }
  return false;
};

const filterInitialNodes = (
  books: any[],
  userLevel: string,
  connections: any[],
  showCount: number = 5
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
    const selectedIds = new Set(selectedBooks.map((b) => b.google_books_id));
    const additionalBooks = books
      .filter((b) => !selectedIds.has(b.google_books_id))
      .slice(0, remainingCount);

    selectedBooks = [...selectedBooks, ...additionalBooks];
  }

  return selectedBooks;
};

const getVisibleNodes = (
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

  const visibleBookIds = visibleBooks.map((b) => b.google_books_id);
  const validConnections = connections.filter((conn) => {
    const isVisible =
      visibleBookIds.includes(conn.from_book_id) &&
      visibleBookIds.includes(conn.to_book_id);

    if (!isVisible) return false;

    const fromBook = books.find((b) => b.google_books_id === conn.from_book_id);
    const toBook = books.find((b) => b.google_books_id === conn.to_book_id);

    return isValidConnection(fromBook, toBook);
  });

  return {
    books: visibleBooks,
    connections: validConnections,
  };
};

const calculatePosition = (
  level: string,
  index: number,
  totalInLevel: number
) => {
  const CANVAS_WIDTH = 800;
  const spacing = CANVAS_WIDTH / (totalInLevel + 1);
  const x = spacing * (index + 1);
  const y = level === "beginner" ? 100 : level === "intermediate" ? 300 : 500;
  return { x, y };
};

export default function KnowledgeGraph({ params }: PageProps) {
  const { topicId } = params;
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);
  const [selectedBook, setSelectedBook] = useState<BookNodeData | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );
  const supabase = createClientComponentClient();
  const { toast } = useToast();
  const router = useRouter();

  const saveGraphLayout = useCallback(
    debounce(async () => {
      try {
        setSaveStatus("saving");
        const layout = {
          nodes: nodes.map((n) => ({
            id: n.id,
            position: n.position,
          })),
          expandedNodes,
          visibleCount,
          lastSaved: new Date().toISOString(),
        };

        const response = await fetch("/api/graph-layout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId, graphLayout: layout }),
        });

        if (!response.ok) throw new Error("Failed to save layout");
        setSaveStatus("saved");
        toast({ description: "Graph layout saved" });
      } catch (error) {
        console.error("Error saving layout:", error);
        setSaveStatus("error");
        toast({
          description: "Failed to save graph layout",
          variant: "destructive",
        });
      }
    }, 1000),
    [nodes, expandedNodes, visibleCount, topicId]
  );

  // Keep all existing callbacks
  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      saveGraphLayout();
    },
    [saveGraphLayout]
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
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

  const handleShowMore = useCallback(() => {
    setExpandedNodes((prev) => {
      const currentlyShown = new Set(prev);
      const nextNodes = nodes
        .filter((node) => !currentlyShown.has(node.id))
        .slice(0, 3)
        .map((node) => node.id);
      const newExpanded = [...prev, ...nextNodes];
      saveGraphLayout();
      return newExpanded;
    });
    setVisibleCount((prev) => Math.min(prev + 3, nodes.length));
  }, [nodes, saveGraphLayout]);

  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      console.log("1. Starting fetchGraphData");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Get user topic and books
      const { data: userTopic, error: topicError } = await supabase
        .from("User_Topics")
        .select("topic_id, status, skill_level")
        .eq("topic_id", topicId)
        .eq("user_id", user.id)
        .single();

      if (topicError) {
        console.error("Topic error:", topicError);
        throw topicError;
      }

      if (!userTopic) {
        router.push("/dashboard");
        toast({
          description: "Topic not found. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // 2. Get books and connections
      const { data: books } = await supabase
        .from("Books")
        .select("*")
        .eq("topic_id", topicId);

      if (!books?.length) {
        toast({
          description: "No books found for this topic. Please try again later.",
          variant: "destructive",
        });
        return;
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

      // 3. Try to get saved layout
      const { data: savedLayout } = await supabase
        .from("User_Graph")
        .select("layout")
        .eq("user_id", user.id)
        .eq("topic_id", topicId)
        .single();

      // 4. Generate graph data
      const visibleData = getVisibleNodes(
        books,
        userTopic.skill_level,
        connections || [],
        expandedNodes
      );

      // 5. Create nodes with either saved or default positions
      const nodes = visibleData.books.map((book, index) => {
        const savedNode = savedLayout?.layout?.nodes?.find(
          (n: any) => n.id === book.google_books_id
        );

        const position =
          savedNode?.position ||
          calculatePosition(
            book.level,
            index,
            visibleData.books.filter((b) => b.level === book.level).length
          );

        return {
          id: book.google_books_id,
          type: "bookNode",
          position,
          data: {
            id: book.google_books_id,
            label: book.title,
            level: book.level,
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
        };
      });

      const edges = visibleData.connections.map((conn) => ({
        id: `${conn.from_book_id}-${conn.to_book_id}`,
        source: conn.from_book_id,
        target: conn.to_book_id,
        animated: true,
        type: "bezier",
      }));

      setNodes(nodes);
      setEdges(edges);
    } catch (error) {
      console.error("Error in fetchGraphData:", error);
      toast({
        description: "Error loading graph. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [expandedNodes, topicId, supabase, router]);

  useEffect(() => {
    console.log("Fetching graph data. Expanded nodes:", expandedNodes);
    fetchGraphData();
  }, [expandedNodes, fetchGraphData]);

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
