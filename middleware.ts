import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  console.log("Middleware Session Check:", {
    hasSession: !!session,
    path: request.nextUrl.pathname,
    timestamp: new Date().toISOString(),
  });

  // Add learning-path to protected routes
  const protectedRoutes = ["/dashboard", "/learning-path"];

  // Check if the current route is protected
  if (protectedRoutes.includes(request.nextUrl.pathname)) {
    // Redirect to login if no session
    if (!session) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  return res;
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
