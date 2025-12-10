import type {AvatarProject} from 'sentry/types/project';

// Access to the feature is controlled by this flag permanently.
// During release, we gate this check elsewhere by the
// data-forwarding-revamp-access flag, so it's fine to omit here.
export const DATA_FORWARDING_FEATURES = ['organizations:data-forwarding'];

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
