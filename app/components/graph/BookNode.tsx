import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

interface BookNodeData {
  label: string;
  level?: string;
}

function BookNode({ data }: { data: BookNodeData }) {
  return (
    <div className="p-2 bg-white border rounded-md shadow-sm">
      <Handle type="target" position={Position.Top} />
      {data.label}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(BookNode);
