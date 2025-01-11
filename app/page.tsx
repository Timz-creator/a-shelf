import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, BarChart3, BookMarked } from "lucide-react";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export default async function Home() {
  // Check if user is logged in
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Get started link changes based on auth state
  const getStartedHref = session ? "/dashboard" : "/auth/login";

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero Section */}
      <section className="px-4 py-20 md:py-32">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                Master any skill with curated book recommendations
              </h1>
              <p className="text-xl text-gray-600">
                Discover the perfect books for your skill level and track your
                progress on an interactive knowledge graph.
              </p>
              <Link
                href={getStartedHref}
                className="inline-flex items-center px-6 py-3 text-lg font-medium text-white bg-green-600 rounded-full hover:bg-green-700 transition-colors duration-300"
              >
                {session ? "Go to Dashboard" : "Get Started"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
            {/* Rest of the code stays the same until the last CTA section */}
          </div>
        </div>
      </section>

      {/* Features Section stays the same */}
      {/* How It Works Section stays the same */}

      {/* CTA Section */}
      <section className="px-4 py-20 bg-green-900 text-white">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to accelerate your learning?
          </h2>
          <p className="text-xl mb-8">
            Join thousands of learners who are mastering new skills with our
            curated book recommendations.
          </p>
          <Link
            href={getStartedHref}
            className="inline-flex items-center px-8 py-4 text-lg font-medium text-white bg-green-600 rounded-full hover:bg-green-700 transition-colors duration-300"
          >
            {session ? "Go to Dashboard" : "Start Your Journey"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
