export type Flow = {
  createdBy: string;
  failures: number;
  id: string;
  lastChecked: string;
  lastSeen: string;
  linkedIssues: string[];
  name: string;
  status: string;
};

export enum Status {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}
