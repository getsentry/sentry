import {PlatformKey} from 'sentry/data/platformCategories';

import {TimeseriesValue} from './core';
import {DynamicSamplingRules} from './dynamicSampling';
import {SDKUpdatesSuggestion} from './event';
import {Plugin} from './integrations';
import {Organization, Team} from './organization';
import {Deploy, Release} from './release';

// Minimal project representation for use with avatars.
export type AvatarProject = {
  slug: string;
  id?: string | number;
  platform?: PlatformKey;
};

export type Project = {
  dateCreated: string;
  digestsMaxDelay: number;
  digestsMinDelay: number;
  // XXX: These are part of the DetailedProject serializer
  dynamicSampling: {
    next_id: number;
    rules: DynamicSamplingRules;
  } | null;
  environments: string[];
  eventProcessing: {
    symbolicationDegraded: boolean;
  };

  features: string[];
  firstEvent: 'string' | null;
  firstTransactionEvent: boolean;
  groupingConfig: string;
  hasAccess: boolean;
  hasSessions: boolean;
  id: string;
  isBookmarked: boolean;
  isInternal: boolean;
  isMember: boolean;
  organization: Organization;
  plugins: Plugin[];

  processingIssues: number;
  relayPiiConfig: string;
  subjectTemplate: string;
  teams: Team[];
  builtinSymbolSources?: string[];
  hasUserReports?: boolean;
  latestDeploys?: Record<string, Pick<Deploy, 'dateFinished' | 'version'>> | null;
  latestRelease?: Release;
  options?: Record<string, boolean | string>;
  sessionStats?: {
    currentCrashFreeRate: number | null;
    hasHealthData: boolean;
    previousCrashFreeRate: number | null;
  };
  stats?: TimeseriesValue[];
  symbolSources?: string;
  transactionStats?: TimeseriesValue[];
} & AvatarProject;

export type MinimalProject = Pick<Project, 'id' | 'slug' | 'platform'>;

// Response from project_keys endpoints.
export type ProjectKey = {
  browserSdk: {
    choices: [key: string, value: string][];
  };
  browserSdkVersion: string;
  dateCreated: string;
  dsn: {
    cdn: string;
    csp: string;
    minidump: string;
    public: string;
    secret: string;
    security: string;
    unreal: string;
  };
  id: string;
  isActive: boolean;
  label: string;
  name: string;
  projectId: string;
  public: string;
  rateLimit: {
    count: number;
    window: string;
  } | null;
  secret: string;
};

export type ProjectSdkUpdates = {
  projectId: string;
  sdkName: string;
  sdkVersion: string;
  suggestions: SDKUpdatesSuggestion[];
};

export type Environment = {
  displayName: string;
  id: string;
  name: string;

  // XXX: Provided by the backend but unused due to `getUrlRoutingName()`
  // urlRoutingName: string;
};

export type TeamWithProjects = Team & {projects: Project[]};

export type PlatformIntegration = {
  id: PlatformKey;
  language: string;
  link: string | null;
  name: string;
  type: string;
};
