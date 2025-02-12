import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/learning-path"];

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  try {
    // Only check auth for protected routes
    if (!protectedRoutes.includes(request.nextUrl.pathname)) {
      return res;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    // Only check User_Graph when accessing dashboard
    if (request.nextUrl.pathname === "/dashboard") {
      const { data: userGraph } = await supabase
        .from("User_Graph")
        .select("topic_id")
        .eq("user_id", session.user.id)
        .single();

      if (userGraph) {
        return NextResponse.redirect(new URL("/learning-path", request.url));
      }
    }

    return res;
  } catch (error) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
