"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

type Topic = {
  id: string;
  title: string;
  icon: string;
  description: string;
};

type TopicDialogProps = {
  topic: Topic;
};

export function TopicDialog({ topic }: TopicDialogProps) {
  const [open, setOpen] = useState(false);
  const [skillLevel, setSkillLevel] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleStartLearning = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // First create/update the user topic
      const { error: topicError } = await supabase.from("User_Topics").insert({
        user_id: user.id,
        topic_id: topic.id,
        skill_level: skillLevel,
        status: "in_progress",
      });

      if (topicError) throw topicError;

      // Continue with book analysis
      const response = await fetch(
        `/api/books?topic=${encodeURIComponent(topic.title)}`
      );
      const books = await response.json();

      // Send books for analysis
      const analysisResponse = await fetch("/api/analyze-books", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          books: books.items,
          topic: {
            id: topic.id,
            title: topic.title,
          },
        }),
      });

      await analysisResponse.json();

      // Navigate to initial learning path
      router.push("/learning-path");
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-32 text-lg font-semibold">
          <div className="flex flex-col items-center">
            <span className="text-4xl mb-2">{topic.icon}</span>
            {topic.title}
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{topic.title}</DialogTitle>
          <DialogDescription className="text-base">
            {topic.description}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <h4 className="text-sm font-medium mb-3">Select your skill level:</h4>
          <RadioGroup onValueChange={setSkillLevel} value={skillLevel}>
            <div className="flex items-center space-x-2 mb-2">
              <RadioGroupItem value="beginner" id="beginner" />
              <Label htmlFor="beginner">Beginner</Label>
            </div>
            <div className="flex items-center space-x-2 mb-2">
              <RadioGroupItem value="intermediate" id="intermediate" />
              <Label htmlFor="intermediate">Intermediate</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="advanced" id="advanced" />
              <Label htmlFor="advanced">Advanced</Label>
            </div>
          </RadioGroup>
        </div>
        <Button
          className="w-full mt-4"
          disabled={!skillLevel || loading}
          onClick={handleStartLearning}
        >
          {loading ? "Loading..." : "Start Learning"}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
