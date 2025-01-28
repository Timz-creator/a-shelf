import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type GraphLayout = {
  nodes: {
    id: string;
    position: { x: number; y: number };
  }[];
  expandedNodes: string[];
  visibleCount: number;
};

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { topicId, graphLayout } = await request.json();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update or insert graph layout
    const { error } = await supabase.from("User_Graph").upsert(
      {
        user_id: user.id,
        topic_id: topicId,
        graph_layout: graphLayout,
        last_updated: new Date().toISOString(),
      },
      {
        onConflict: "user_id,topic_id",
      }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving graph layout:", error);
    return NextResponse.json(
      { error: "Failed to save graph layout" },
      { status: 500 }
    );
  }
}
