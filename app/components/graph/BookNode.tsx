import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

interface BookNodeData {
  id: string;
  label: string;
  level: "beginner" | "intermediate" | "advanced";
  status: "not_started" | "in_progress" | "completed";
  isAdvanced: boolean;
  onClick: () => void;
}

// Apple system colors for difficulty levels
const LEVEL_COLORS = {
  beginner: "#34C759", // Apple Green
  intermediate: "#FFCC00", // Apple Yellow
  advanced: "#FF3B30", // Apple Red
} as const;

// Progress status colors
const STATUS_COLORS = {
  not_started: "#E5E5EA", // Light Gray
  in_progress: "#007AFF", // Blue
  completed: "#AF52DE", // Purple
} as const;

function BookNode({ data }: { data: BookNodeData }) {
  console.log("BookNode rendering with data:", data);
  return (
    <div
      className="relative p-2 bg-white border rounded-md shadow-sm min-w-[150px] cursor-pointer hover:shadow-md transition-shadow"
      onClick={data.onClick}
    >
      {/* Top handle for connecting edges */}
      <Handle type="target" position={Position.Top} className="!bg-gray-300" />

      {/* Book title or label with bottom padding for dot space */}
      <div className="text-sm pb-4 font-semibold">{data.label}</div>

      {/* Level indicator dot - moved closer to corner */}
      <div
        className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: LEVEL_COLORS[data.level],
        }}
        title={`${
          data.level.charAt(0).toUpperCase() + data.level.slice(1)
        } Level`}
      />

      {/* Progress status dot with label */}
      <div className="absolute bottom-1 left-1 flex items-center gap-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: STATUS_COLORS[data.status],
          }}
          title={`${
            data.status.charAt(0).toUpperCase() + data.status.slice(1)
          } Status`}
        />
        <span className="text-xs font-medium text-gray-600">
          {data.status
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")}
        </span>
      </div>

      {/* Bottom handle for connecting edges */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-300"
      />
    </div>
  );
}

export default memo(BookNode);
