"use client";

import {
  ActiveLearningPathCard,
  EmptyLearningPathCard,
} from "./LearningPathCard";

interface LearningPathsSectionProps {
  userTopics:
    | {
        topic_id: string;
        skill_level: string;
        Topics: {
          title: string;
          icon: string;
        };
      }[]
    | null;
}

export function LearningPathsSection({
  userTopics,
}: LearningPathsSectionProps) {
  const handleChooseTopic = () => {
    document
      .getElementById("topicSection")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="px-4 py-12 bg-gray-50">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-2xl font-bold mb-6">Your Learning Paths</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {userTopics && userTopics.length > 0 ? (
            <>
              {userTopics.map((topic) => (
                <ActiveLearningPathCard
                  key={topic.topic_id}
                  icon={topic.Topics.icon}
                  title={topic.Topics.title}
                  level={topic.skill_level}
                  topicId={topic.topic_id}
                />
              ))}
              {userTopics.length < 3 && (
                <EmptyLearningPathCard onChooseTopic={handleChooseTopic} />
              )}
            </>
          ) : (
            Array.from({ length: 3 }).map((_, i) => (
              <EmptyLearningPathCard
                key={i}
                onChooseTopic={handleChooseTopic}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
