export type Incident = {
  id: string;
  identifier: string;
  organizationId: string;
  title: string;
  status: number;
  query: string;
  projects: number[];
  eventStats: {
    data: Array<Array<number | Array<any>>>;
  };
  totalEvents: number;
  uniqueUsers: number;
  isSubscribed: boolean;
  dateClosed: string;
  dateStarted: string;
  dateDetected: string;
  dateAdded: string;
};
