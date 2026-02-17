export enum AlertDebugSelectionType {
  ISSUE_ID = 'Issue ID(s)',
  TIME_RANGE = 'Date Range',
}

export interface AlertDebugFormData {
  workflowId: number;
  dateRange?: {
    end: Date;
    start: Date;
  };
  issueIds?: number[];
}
