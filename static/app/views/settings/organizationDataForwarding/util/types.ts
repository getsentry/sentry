import type {AvatarProject} from 'sentry/types/project';

export enum DataForwarderProviderSlug {
  SEGMENT = 'segment',
  SQS = 'sqs',
  SPLUNK = 'splunk',
}

interface DataForwarderProject {
  dataForwarderId: string;
  effectiveConfig: Record<string, any>;
  id: string;
  isEnabled: boolean;
  overrides: Record<string, any>;
  project: Required<AvatarProject>;
}

export interface DataForwarder {
  // A `null` config indicates the observing user lacks permission to manage/view the config.
  config: Record<string, any> | null;
  enrollNewProjects: boolean;
  enrolledProjects: Array<Required<AvatarProject>>;
  id: string;
  isEnabled: boolean;
  organizationId: string;
  projectConfigs: DataForwarderProject[];
  provider: DataForwarderProviderSlug;
}

/** Snake-case request body sent to the API when creating or updating a DataForwarder. */
export interface DataForwarderPayload {
  config: Record<string, string | undefined>;
  enroll_new_projects: boolean;
  is_enabled: boolean;
  project_ids: string[];
  provider: DataForwarderProviderSlug;
}
