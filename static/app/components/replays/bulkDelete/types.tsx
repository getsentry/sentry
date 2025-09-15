export type ReplayBulkDeleteAuditLog = {
  countDeleted: number;
  dateCreated: string;
  dateUpdated: string;
  environments: string[];
  id: string | number;
  query: string;
  rangeEnd: string;
  rangeStart: string;
  status: 'pending' | 'in-progress' | 'completed';
};
