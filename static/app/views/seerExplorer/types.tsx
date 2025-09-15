export interface Block {
  id: string;
  message: Message;
  timestamp: string;
  loading?: boolean;
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

export type PanelSize = 'max' | 'med' | 'min';

export interface ExplorerPanelProps {
  isVisible?: boolean;
  onClose?: () => void;
}
