export interface Block {
  content: string;
  id: string;
  timestamp: string;
  type: 'message' | 'user-input' | 'response';
  loading?: boolean;
}

export type PanelSize = 'max' | 'med' | 'min';

export interface ExplorerPanelProps {
  isVisible?: boolean;
  onClose?: () => void;
}
