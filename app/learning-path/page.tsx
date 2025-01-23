"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import ReactFlow, {
  type Node,
  type Edge,
  Controls,
  Background,
  NodeTypes,
  applyNodeChanges,
  applyEdgeChanges,
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
import BookNode from "@/app/components/graph/BookNode";
import { nodeTypes } from "@/app/components/graph/nodeTypes";

export default function KnowledgeGraph() {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const supabase = createClientComponentClient();

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

  const fetchGraphData = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No session found");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const { data: userTopics } = await supabase
        .from("User_Topics")
        .select("topic_id")
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false });

      if (!userTopics || userTopics.length === 0) {
        throw new Error("No topics selected");
      }

      const mostRecentTopic = userTopics[0];

      const { data: books } = await supabase
        .from("Books")
        .select("*")
        .eq("topic_id", mostRecentTopic.topic_id);

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

      if (books && connections) {
        const levelCounts = {
          beginner: 0,
          intermediate: 0,
          advanced: 0,
        };

        books.forEach((book) => {
          levelCounts[book.level as keyof typeof levelCounts]++;
        });

        const spacing = {
          beginner: 800 / (levelCounts.beginner + 1),
          intermediate: 800 / (levelCounts.intermediate + 1),
          advanced: 800 / (levelCounts.advanced + 1),
        };

        const currentX = {
          beginner: 0,
          intermediate: 0,
          advanced: 0,
        };

        const nodes = books.map((book) => {
          const level = book.level as keyof typeof levelCounts;
          currentX[level] += spacing[level];

          return {
            id: book.google_books_id,
            type: "bookNode",
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
    fetchGraphData();
  }, []);

  return (
    <div className="p-4 w-full min-h-screen">
      <Card className="w-full h-[800px]">
        <CardHeader>
          <CardTitle>Knowledge Graph</CardTitle>
          <CardDescription>Visualizing topic relationships</CardDescription>
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
    </div>
  );
}
