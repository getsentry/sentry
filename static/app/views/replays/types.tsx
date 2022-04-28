export type Replay = {
  eventID: string;
  id: string;
  project: string;
  timestamp: string;
  url: string;
  'user.display': string;
};

export type TabBarId = 'console' | 'performance' | 'errors' | 'tags' | 'memory';

/**
 * Highlight Replay Plugin types
 */
export type HighlightsByTime = Map<number, Highlight>;
export interface Highlight {
  nodeId: number;
  color?: string;
}
