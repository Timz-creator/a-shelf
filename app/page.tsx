import Image from "next/image";
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  ArrowRight,
  BookOpen,
  BarChart3,
  BookMarked,
  ChevronRight,
} from "lucide-react";

export default async function Home() {
  // Check if user is logged in
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Get started link changes based on auth state
  const getStartedHref = session ? "/dashboard" : "/auth/login";

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Hero Section */}
      <section className="px-4 py-24 md:py-32">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-8 mb-16">
            {/* Floating Stats */}
            <div className="relative">
              <div className="absolute -top-8 left-1/4 bg-black text-white px-4 py-2 rounded-full transform -rotate-6">
                1.4M+ Books
              </div>
              <div className="absolute -top-4 right-1/4 bg-black text-white px-4 py-2 rounded-full transform rotate-3">
                35+ Skills
              </div>
            </div>

            <div className="relative">
              <h1 className="text-6xl md:text-7xl font-bold leading-tight tracking-tight">
                Master
                <span className="block text-8xl md:text-9xl bg-gradient-to-r from-black to-gray-600 bg-clip-text text-transparent">
                  BOOKS
                </span>
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto mt-6">
                Assemble your perfect reading list and challenge yourself to
                become the best of the best!
              </p>
            </div>

            <Link
              href={getStartedHref}
              className="inline-flex items-center px-8 py-4 text-lg font-medium text-white bg-black rounded-full hover:bg-gray-900 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {session ? "Go to Dashboard" : "Start Reading"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>

          <div className="relative h-[600px] w-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-m4zSf1hUBUcTeFwtJbg1fVaGeeber2.png"
              alt="Robot reading a book"
              layout="fill"
              objectFit="contain"
              className="rounded-3xl"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-24 bg-gray-50">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-4xl font-bold text-center mb-16 tracking-tight">
            Level Up Your Skills
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                icon: <BookOpen className="h-10 w-10 text-black" />,
                title: "Personalized Quest",
                description:
                  "Get book recommendations tailored to your current skill level and goals.",
                stat: "95% Match Rate",
              },
              {
                icon: <BarChart3 className="h-10 w-10 text-black" />,
                title: "Skill Tree",
                description:
                  "Track your progress with an interactive knowledge visualization system.",
                stat: "+45% Learning Speed",
              },
              {
                icon: <BookMarked className="h-10 w-10 text-black" />,
                title: "Achievement Library",
                description:
                  "Unlock achievements as you complete books and master new skills.",
                stat: "500+ Achievements",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="absolute -top-4 -right-4 bg-black text-white text-sm px-3 py-1 rounded-full">
                  {feature.stat}
                </div>
                <div className="inline-block p-4 bg-gray-100 rounded-2xl mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-semibold mb-4">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 py-24 bg-black text-white">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-4xl font-bold text-center mb-16 tracking-tight">
            Your Learning Adventure
          </h2>
          <div className="grid md:grid-cols-2 gap-12">
            {[
              {
                step: "01",
                title: "Choose Your Path",
                description:
                  "Select the skills you want to master from our extensive skill tree.",
              },
              {
                step: "02",
                title: "Set Your Level",
                description:
                  "Take a quick assessment to determine your current knowledge level.",
              },
              {
                step: "03",
                title: "Get Your Quest",
                description:
                  "Receive a personalized reading list tailored to your goals.",
              },
              {
                step: "04",
                title: "Track Progress",
                description:
                  "Level up your skills and unlock achievements as you read.",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="relative bg-white/5 backdrop-blur-lg rounded-2xl p-8 overflow-hidden group hover:bg-white/10 transition-all duration-300"
              >
                <div className="absolute -top-4 -left-4 w-24 h-24 bg-white rounded-full flex items-center justify-center">
                  <span className="text-black text-4xl font-bold">
                    {item.step}
                  </span>
                </div>
                <div className="ml-16">
                  <h3 className="text-2xl font-semibold mb-4">{item.title}</h3>
                  <p className="text-white/70 mb-4">{item.description}</p>
                  <ChevronRight className="w-6 h-6 text-white/50 group-hover:text-white transition-all duration-300" />
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-white/0 via-white/50 to-white/0 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-24 bg-gradient-to-b from-gray-100 to-white">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="bg-black text-white rounded-3xl p-12 shadow-2xl">
            <h2 className="text-4xl font-bold mb-6 tracking-tight">
              Ready to Begin Your Journey?
            </h2>
            <p className="text-xl mb-8 text-white/70">
              Join thousands of readers who are leveling up their skills through
              our curated book recommendations.
            </p>
            <Link
              href={getStartedHref}
              className="inline-flex items-center px-8 py-4 text-lg font-medium text-black bg-white rounded-full hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {session ? "Go to Dashboard" : "Start Your Adventure"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
