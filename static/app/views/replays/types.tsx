export type Replay = {
  eventID: string;
  id: string;
  project: string;
  timestamp: string;
  url: string;
  'user.display': string;
  'user.email': string;
  'user.id': string;
  'user.ip_address': string;
  'user.name': string;
  'user.username': string;
};

export enum ReplayTabs {
  CONSOLE = 'console',
  PERFORMANCE = 'performance',
  TRACE = 'trace',
  ISSUES = 'issues',
  TAGS = 'tags',
  MEMORY = 'memory',
}

export function isReplayTab(tab: string): tab is ReplayTabs {
  return tab.toUpperCase() in ReplayTabs;
}

/**
 * Highlight Replay Plugin types
 */
export interface Highlight {
  nodeId: number;
  text: string;
  color?: string;
}
