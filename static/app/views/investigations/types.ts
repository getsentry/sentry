export type InvestigationListItem = {
  blockCount: number;
  createdBy: string | null;
  dateCreated: string;
  dateUpdated: string;
  id: string;
  isFavorited: boolean;
  sourceType: string;
  status: string;
  title: string;
  version: number;
};

// Expand this response type as the detail UI begins consuming additional fields.
// The complete server response is retained at runtime in the query cache.
export type InvestigationDetail = InvestigationListItem;

export type MetricOpenPeriodInvestigationSource = {
  ref: {
    groupId: string;
    openPeriodId: string;
  };
  type: 'metric_open_period';
};

export type InvestigationCandidate =
  | {status: 'investigate'}
  | {status: 'unavailable'}
  | {investigationId: string; status: 'view'};
