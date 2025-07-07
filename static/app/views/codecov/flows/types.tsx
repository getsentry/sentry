export type Flow = {
  createdBy: string;
  failures: number;
  id: string;
  lastChecked: string;
  lastSeen: string;
  linkedIssues: string[];
  name: string;
  status: string;
  metadata?: {
    endBreadcrumb?: string | null;
    endBreadcrumbData?: {
      breadcrumbId: string;
      offsetMs: number;
    };
    orgSlug?: string;
    replaySlug?: string;
    startBreadcrumb?: string | null;
    startBreadcrumbData?: {
      breadcrumbId: string;
      offsetMs: number;
    };
  };
};

export enum Status {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}
