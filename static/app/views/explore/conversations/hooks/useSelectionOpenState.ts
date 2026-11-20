import {useState} from 'react';

/**
 * Open state for a collapsible transcript row that can hold the selected span.
 * The row opens whenever a span inside it becomes selected: when the selection
 * moves to another span inside it, and when the selected span only loads after
 * the row first rendered. Otherwise it stays as the user left it.
 *
 * @param selectedNodeIdInside The selected span's id when that span is inside
 * the row, otherwise null.
 */
export function useSelectionOpenState(selectedNodeIdInside: string | null) {
  const [isOpen, setIsOpen] = useState(selectedNodeIdInside !== null);
  // Adjusted during render rather than in an effect, so the row opens in the
  // same render the selection reaches it.
  const [revealedNodeId, setRevealedNodeId] = useState(selectedNodeIdInside);
  if (selectedNodeIdInside !== revealedNodeId) {
    setRevealedNodeId(selectedNodeIdInside);
    if (selectedNodeIdInside !== null) {
      setIsOpen(true);
    }
  }
  return [isOpen, setIsOpen] as const;
}
