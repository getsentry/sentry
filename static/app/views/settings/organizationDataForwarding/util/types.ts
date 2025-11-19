import type {AvatarProject} from 'sentry/types/project';

export enum DataForwarderProviderSlug {
  SEGMENT = 'segment',
  SQS = 'sqs',
  SPLUNK = 'splunk',
}

export const ProviderLabels: Record<DataForwarderProviderSlug, string> = {
  [DataForwarderProviderSlug.SPLUNK]: 'Splunk',
  [DataForwarderProviderSlug.SEGMENT]: 'Segment',
  [DataForwarderProviderSlug.SQS]: 'Amazon SQS',
};

interface DataForwarderProject {
  dataForwarderId: string;
  effectiveConfig: Record<string, any>;
  id: string;
  isEnabled: boolean;
  overrides: Record<string, any>;
  project: Required<AvatarProject>;
}

export interface DataForwarder {
  config: Record<string, any>;
  enrollNewProjects: boolean;
  enrolledProjects: Array<Required<AvatarProject>>;
  id: string;
  isEnabled: boolean;
  organizationId: string;
  projectConfigs: DataForwarderProject[];
  provider: DataForwarderProviderSlug;
}
