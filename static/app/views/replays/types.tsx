export type Replay = {
  count_if_event_type_equals_error: number;
  'equation[0]': number;
  eventID: string;
  id: string;
  max_timestamp: string;
  min_timestamp: string;
  project: string;
  timestamp: string;
  url: string;
  'user.display': string;
};

export type TabBarId = 'console' | 'performance' | 'errors' | 'tags';
