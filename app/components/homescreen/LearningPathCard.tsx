import Link from "next/link";
import { ArrowRight, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActiveLearningPathProps {
  icon: string;
  title: string;
  level: string;
  topicId: string;
}

export function ActiveLearningPathCard({
  icon,
  title,
  level,
  topicId,
}: ActiveLearningPathProps) {
  console.log("ActiveLearningPathCard topicId:", topicId);
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm transition-all duration-300 ease-in-out hover:shadow-md hover:scale-[1.02]">
      <div className="flex items-center mb-4">
        <span className="text-4xl mr-3">{icon}</span>
        <div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-sm text-gray-500">{level}</p>
        </div>
      </div>
      <Button className="w-full" asChild>
        <Link href={`/learning-path/${topicId}`}>
          Continue Learning
          <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
      </Button>
    </div>
  );
}

interface EmptyLearningPathProps {
  onChooseTopic: () => void;
}

export function EmptyLearningPathCard({
  onChooseTopic,
}: EmptyLearningPathProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center h-[180px] transition-all duration-300 ease-in-out hover:shadow-md hover:scale-[1.02]">
      <PlusCircle className="h-12 w-12 text-gray-300 mb-3" />
      <p className="text-gray-500 text-center mb-3">
        Start a new learning path
      </p>
      <Button variant="outline" size="sm" onClick={onChooseTopic}>
        Choose a Topic
      </Button>
    </div>
  );
}
