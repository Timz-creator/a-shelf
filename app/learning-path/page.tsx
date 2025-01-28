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

export default function KnowledgeGraph() {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [user, setUser] = useState<any>(null);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(5); // Start with 5 nodes
  const [selectedBook, setSelectedBook] = useState<BookNodeData | null>(null); // Track selected book
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

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  // Add node click handler
  const onNodeClick = useCallback((event: any, node: Node) => {
    setExpandedNodes((prev) => {
      const isExpanded = prev.includes(node.id);
      return isExpanded
        ? prev.filter((id) => id !== node.id) // Collapse
        : [...prev, node.id]; // Expand
    });
  }, []);

  // Update the handleShowMore function
  const handleShowMore = useCallback(() => {
    // Get next batch of books based on current visible count
    setExpandedNodes((prev) => {
      // Get next 3 nodes that aren't already shown
      const currentlyShown = new Set(prev);
      const nextNodes = nodes
        .filter((node) => !currentlyShown.has(node.id))
        .slice(0, 3)
        .map((node) => node.id);

      return [...prev, ...nextNodes];
    });

    // Update visible count based on actual shown nodes
    setVisibleCount((prev) => Math.min(prev + 3, nodes.length));
  }, [nodes]);

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

      const { data: books } = await supabase
        .from("Books")
        .select("*")
        .eq("topic_id", mostRecentTopic.topic_id);

      console.log("5. Books found:", books?.length);

      if (!books) throw new Error("No books found");

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
            };

            console.log("Node data:", nodeData);
            return nodeData;
          });
        });

        // Create edges from valid connections
        const edges = visibleData.connections.map((conn) => ({
          id: `${conn.from_book_id}-${conn.to_book_id}`,
          source: conn.from_book_id,
          target: conn.to_book_id,
          animated: true,
          type: "bezier",
        }));

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

      if (!isVisible) return false;

      const fromBook = books.find(
        (b) => b.google_books_id === conn.from_book_id
      );
      const toBook = books.find((b) => b.google_books_id === conn.to_book_id);

      const isValid = isValidConnection(fromBook, toBook);
      return isValid;
    });

    console.log("Final output:", {
      visibleBooks: visibleBooks.length,
      validConnections: validConnections.length,
    });

    return {
      books: visibleBooks,
      connections: validConnections,
    };
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
