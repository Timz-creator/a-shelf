import BookNode from "./BookNode";
import PreviewNode from "./PreviewNode";

export const nodeTypes = {
  bookNode: BookNode,
  previewNode: PreviewNode,
} as const;
