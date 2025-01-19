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
  const [skillLevel, setSkillLevel] = useState<string | undefined>(undefined);
  const supabase = createClientComponentClient();

  const handleStartLearning = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      // Insert into user_topics
      const { data, error } = await supabase
        .from("User_Topics")
        .insert({
          user_id: user?.id,
          topic_id: topic.id,
          skill_level: skillLevel,
          status: "in_progress",
        })
        .select()
        .single();

      if (error) throw error;

      console.log("Topic selected successfully:", data);
    } catch (error) {
      console.error("Error:", error);
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
          disabled={!skillLevel}
          onClick={handleStartLearning}
        >
          Start Learning
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
