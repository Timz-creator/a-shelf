import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopicDialog } from "/Users/timarleyfoster/Desktop/a-shelf/app/components/homescreen/topic-dialog";
import { SearchTopics } from "/Users/timarleyfoster/Desktop/a-shelf/app/components/homescreen/search-topics";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { LearningPathsSection } from "@/app/components/homescreen/LearningPathsSection";

export const metadata: Metadata = {
  title: "'Dashboard | BookMaster'",
  description: "'Your personal learning dashboard'",
};

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });

  // Get current user's topics
  const { data: userTopics } = await supabase
    .from("User_Topics")
    .select(
      `
      topic_id,
      skill_level,
      Topics (
        title,
        icon
      )
    `
    )
    .eq("status", "in_progress");

  // Existing topics query for the topic selection section
  const { data: topics, error } = await supabase
    .from("Topics")
    .select("*")
    .order("title", { ascending: true });

  if (error) {
    console.error("Error fetching topics:", error);
    // Handle error state
  }

  if (!topics) {
    console.log("No topics found");
    return null; // or show empty state
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Hero Section */}
      <section className="px-4 py-12">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-4xl font-bold mb-4">Welcome to BookMaster</h1>
          <p className="text-xl text-gray-600 mb-8">
            Start your learning journey today. Choose a topic and discover
            curated book recommendations tailored to your interests and skill
            level.
          </p>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Choose a Topic Button */}
            <div className="md:col-span-2 bg-gray-100 rounded-3xl p-8 flex flex-col justify-between">
              <h2 className="text-2xl font-semibold mb-4">Ready to explore?</h2>
              <Button
                size="lg"
                variant="default"
                className="w-full md:w-auto text-lg"
                asChild
              >
                <Link href="#topicSection">
                  Choose Your First Topic
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

            {/* Getting Started Card */}
            <div className="bg-black text-white rounded-3xl p-8">
              <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Choose a topic</li>
                <li>Set your skill level</li>
                <li>Get personalized book recommendations</li>
                <li>Track your progress</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Replace the Learning Paths section with the new component */}
      <LearningPathsSection userTopics={userTopics} />

      {/* Topic Selection Screen */}
      <section id="topicSection" className="px-4 py-12 bg-white">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold mb-2">Choose a Topic</h2>
          <p className="text-gray-600 mb-6">
            Select a topic to begin your learning journey and get personalized
            book recommendations.
          </p>

          <SearchTopics topics={topics} />

          {/* Topics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {topics.map((topic) => (
              <TopicDialog key={topic.id} topic={topic} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
