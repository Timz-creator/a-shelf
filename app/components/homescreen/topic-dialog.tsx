"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>{topic.title}</DialogTitle>
          <DialogDescription>{topic.description}</DialogDescription>
        </DialogHeader>
        <Button className="mt-4">
          Start Learning
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
