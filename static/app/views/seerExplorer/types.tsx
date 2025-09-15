export interface Block {
  id: string;
  message: Message;
  timestamp: string;
  loading?: boolean;
  tool_input?: ToolInput;
  tool_response?: string;
}

interface ToolInput {
  args: Record<string, any>;
  function: string;
}

interface Message {
  content: string;
  role: 'user' | 'assistant' | 'tool_use';
}

export type PanelSize = 'max' | 'med' | 'min';

export interface ExplorerPanelProps {
  isVisible?: boolean;
  onClose?: () => void;
}
