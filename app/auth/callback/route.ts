import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });

    // Exchange code for session
    await supabase.auth.exchangeCodeForSession(code);

    // Get user data
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Error getting user:", userError);
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    if (user) {
      // Check if user profile exists
      const { data: existingProfile } = await supabase
        .from("Users")
        .select()
        .eq("id", user.id)
        .single();

      // Create profile if doesn't exist
      if (!existingProfile) {
        const { error: profileError } = await supabase.from("Users").insert({
          id: user.id,
          email: user.email,
          name: user.user_metadata.full_name,
        });

        if (profileError) {
          console.error("Error creating profile:", {
            code: profileError.code,
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
          });
        }
      }
    }
  }

  // Redirect to dashboard
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
