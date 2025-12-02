export interface Block {
  id: string;
  message: Message;
  timestamp: string;
  loading?: boolean;
  tool_links?: Array<ToolLink | null>;
  tool_results?: Array<ToolResult | null>;
}

export interface ToolLink {
  kind: string;
  params: Record<string, any>;
}

interface ToolResult {
  tool_call_id: string;
  // other fields are unused for now.
}

export interface ToolCall {
  args: string;
  function: string;
  id: string;
}

interface Message {
  content: string;
  role: 'user' | 'assistant' | 'tool_use';
  tool_calls?: ToolCall[];
}

export type PanelSize = 'max' | 'med';

export interface ExplorerPanelProps {
  isVisible?: boolean;
  onClose?: () => void;
}

export interface ExplorerSession {
  created_at: string; // ISO date string
  last_triggered_at: string;
  run_id: number;
  title: string; // ISO date string
}
