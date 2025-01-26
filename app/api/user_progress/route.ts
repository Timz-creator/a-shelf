import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type ProgressStatus = "not_started" | "in_progress" | "completed";

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { bookId, status } = await request.json();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update or insert progress
    const { error } = await supabase.from("User_Progress").upsert(
      {
        user_id: user.id,
        book_id: bookId,
        status: status as ProgressStatus,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,book_id", // This ensures update instead of insert for existing combinations
        ignoreDuplicates: false,
      }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating progress:", error);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    );
  }
}
