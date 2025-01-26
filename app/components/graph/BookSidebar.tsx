import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";

type ProgressStatus = "not_started" | "in_progress" | "completed";

type Book = {
  id: string;
  title: string;
  description: string; // Add description field
  isAdvanced: boolean;
  status: ProgressStatus;
};

type BookSidebarProps = {
  book: Book | null;
  onClose: () => void;
  onStatusChange: (id: string, status: ProgressStatus) => void;
};

const statusLabels: Record<ProgressStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const statusColors: Record<ProgressStatus, string> = {
  not_started: "#E5E5EA",
  in_progress: "#007AFF",
  completed: "#AF52DE",
};

export function BookSidebar({
  book,
  onClose,
  onStatusChange,
}: BookSidebarProps) {
  if (!book) return null;

  const handleStatusChange = async (newStatus: ProgressStatus) => {
    try {
      const response = await fetch("/api/user_progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookId: book.id, status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update progress");
      }

      onStatusChange(book.id, newStatus);

      <Toast>
        <ToastTitle>Progress updated!</ToastTitle>
        <ToastDescription>
          {`${book.title} is now ${statusLabels[newStatus].toLowerCase()}.`}
        </ToastDescription>
      </Toast>;
    } catch (error) {
      console.error("Error updating progress:", error);
      <Toast>
        <ToastTitle>Error</ToastTitle>
        <ToastDescription>
          Failed to update progress. Please try again.
        </ToastDescription>
      </Toast>;
    }
  };

  return (
    <div className="fixed top-0 right-0 h-screen w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Book Details</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">{book.title}</h3>
          {book.isAdvanced && (
            <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full mt-1">
              Advanced
            </span>
          )}
        </div>

        {/* Add book description */}
        <div>
          <p className="text-sm text-gray-600">{book.description}</p>
        </div>

        <div>
          <label
            htmlFor="status-select"
            className="block text-sm font-medium text-black"
          >
            Current Status
          </label>

          <Select onValueChange={handleStatusChange} defaultValue={book.status}>
            <SelectTrigger
              id="status-select"
              className="w-full"
              aria-label="Update progress status"
            >
              <SelectValue placeholder="Update Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="not_started"
                className="text-black hover:text-black"
              >
                Not Started
              </SelectItem>
              <SelectItem
                value="in_progress"
                className="text-black hover:text-black"
              >
                In Progress
              </SelectItem>
              <SelectItem
                value="completed"
                className="text-black hover:text-black"
              >
                Completed
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
