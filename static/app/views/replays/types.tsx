export type Replay = {
  eventID: string;
  id: string;
  project: string;
  timestamp: string;
  url: string;
  'user.display': string;
};

export type TabBarId = 'console' | 'performance' | 'errors' | 'tags' | 'memory';
