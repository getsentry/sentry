export type StatsEventParameters = {
  'stats.docs_clicked': {
    projects: string;
    source:
      | 'card-accepted'
      | 'card-filtered'
      | 'card-rate-limited'
      | 'card-invalid'
      | 'chart-title';
  };
};

export const statsEventMap: Record<keyof StatsEventParameters, string> = {
  'stats.docs_clicked': 'Stats: Docs Clicked',
};
