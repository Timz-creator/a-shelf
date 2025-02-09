import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

interface PreviewNodeProps {
  data: {
    id: string;
    label: string;
    level: "beginner" | "intermediate" | "advanced";
  };
}

// Apple system colors for difficulty levels (same as BookNode)
const LEVEL_COLORS = {
  beginner: "#34C759", // Apple Green
  intermediate: "#FFCC00", // Apple Yellow
  advanced: "#FF3B30", // Apple Red
} as const;

function PreviewNode({ data }: PreviewNodeProps) {
  return (
    <div
      className="relative p-2 bg-white bg-opacity-50 border border-gray-200 rounded-md shadow-sm min-w-[150px] cursor-pointer hover:shadow-md transition-shadow"
      style={{ filter: "blur(1px)" }} // Add a slight blur effect for preview
    >
      {/* Top handle for connecting edges */}
      <Handle type="target" position={Position.Top} className="!bg-gray-300" />

      {/* Book title or label with bottom padding for dot space */}
      <div className="text-sm pb-4 font-semibold truncate">{data.label}</div>

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

      {/* Bottom handle for connecting edges */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-300"
      />
    </div>
  );
}

export default memo(PreviewNode);
