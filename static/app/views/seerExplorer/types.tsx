export interface Block {
  id: string;
  message: Message;
  timestamp: string;
  loading?: boolean;
  tool_links?: Array<ToolLink | null>;
}

export interface ToolLink {
  kind: string;
  params: Record<string, any>;
}

interface Message {
  content: string;
  role: 'user' | 'assistant' | 'tool_use';
  tool_calls?: ToolCall[];
}

interface ToolCall {
  args: string;
  function: string;
}

export type PanelSize = 'max' | 'med';

export interface ExplorerPanelProps {
  isVisible?: boolean;
  onClose?: () => void;
}
