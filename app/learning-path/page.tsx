"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSession } from "@/app/providers";
import ReactFlow, {
  type Node,
  type Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function KnowledgeGraph() {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const supabase = createClientComponentClient();
  const { session, loading: sessionLoading } = useSession();

  // Memoize the node types
  const nodeTypes = useMemo(
    () => ({
      default: ({ data }) => (
        <div className="px-4 py-2 shadow-md rounded-md bg-white border-2">
          {data.label}
        </div>
      ),
    }),
    []
  );

  // Memoize the edge types
  const edgeTypes = useMemo(
    () => ({
      default: ({ id, source, target }) => (
        <div className="react-flow__edge-path">{/* Edge content */}</div>
      ),
    }),
    []
  );

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const fetchGraphData = async () => {
    try {
      setLoading(true);

      // No need to fetch user separately now
      if (!session?.user) throw new Error("User not found");

      const { data: userTopic } = await supabase
        .from("User_Topics")
        .select("topic_id")
        .eq("user_id", session.user.id)
        .single();

      if (!userTopic) throw new Error("No topic selected");

      // Get books for this topic
      const { data: books } = await supabase
        .from("Books")
        .select("*")
        .eq("topic_id", userTopic.topic_id);

      if (!books) throw new Error("No books found");

      // Get connections for these books
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

      if (books && connections) {
        // Calculate positions by level
        const levelCounts = {
          beginner: 0,
          intermediate: 0,
          advanced: 0,
        };

        // First pass: count nodes per level
        books.forEach((book) => {
          levelCounts[book.level as keyof typeof levelCounts]++;
        });

        // Calculate horizontal spacing for each level
        const spacing = {
          beginner: 800 / (levelCounts.beginner + 1),
          intermediate: 800 / (levelCounts.intermediate + 1),
          advanced: 800 / (levelCounts.advanced + 1),
        };

        // Track current position for each level
        const currentX = {
          beginner: 0,
          intermediate: 0,
          advanced: 0,
        };

        // Transform to nodes with calculated positions
        const nodes = books.map((book) => {
          const level = book.level as keyof typeof levelCounts;
          currentX[level] += spacing[level];

          return {
            id: book.google_books_id,
            data: { label: book.title },
            position: {
              x: currentX[level],
              y:
                level === "beginner"
                  ? 100
                  : level === "intermediate"
                  ? 300
                  : 500,
            },
            style: {
              border: "1px solid #000",
              borderRadius: "8px",
              padding: "10px",
            },
          };
        });

        const edges = connections.map((conn) => ({
          id: `${conn.from_book_id}-${conn.to_book_id}`,
          source: conn.from_book_id,
          target: conn.to_book_id,
          animated: true,
        }));

        setNodes(nodes);
        setEdges(edges);
      }
    } catch (error) {
      console.error("Error fetching graph data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      fetchGraphData();
    }
  }, [sessionLoading]);

  return (
    <div className="p-4 w-full min-h-screen">
      <Card className="w-full h-[800px]">
        <CardHeader>
          <CardTitle>Knowledge Graph</CardTitle>
          <CardDescription>
            Visualizing the relationships between topics and skill levels
          </CardDescription>
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
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              style={{ width: "100%", height: "100%" }}
              attributionPosition="bottom-left"
            >
              <Background color="#f0f0f0" variant="dots" />
              <Controls />
            </ReactFlow>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
