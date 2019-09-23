export type IncidentRule = {
  aggregations: number[];
  aggregation?: number;
  alertThreshold: number;
  dataset: 'events';
  dateAdded: string;
  dateModified: string;
  id: string;
  name: string;
  projectId: string;
  query: string;
  resolution: number;
  resolveThreshold: number;
  status: number;
  thresholdPeriod: number;
  thresholdType: number;
  timeWindow: number;
};
