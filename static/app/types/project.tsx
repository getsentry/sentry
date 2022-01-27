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
  platform?: PlatformKey;
  id?: string | number;
};

export type Project = {
  id: string;
  dateCreated: string;
  isMember: boolean;
  teams: Team[];
  features: string[];
  organization: Organization;

  isBookmarked: boolean;
  isInternal: boolean;
  hasUserReports?: boolean;
  hasAccess: boolean;
  hasSessions: boolean;
  firstEvent: 'string' | null;
  firstTransactionEvent: boolean;
  subjectTemplate: string;
  digestsMaxDelay: number;
  digestsMinDelay: number;
  environments: string[];
  eventProcessing: {
    symbolicationDegraded: boolean;
  };

  // XXX: These are part of the DetailedProject serializer
  dynamicSampling: {
    next_id: number;
    rules: DynamicSamplingRules;
  } | null;
  plugins: Plugin[];
  processingIssues: number;
  relayPiiConfig: string;
  groupingConfig: string;
  latestDeploys?: Record<string, Pick<Deploy, 'dateFinished' | 'version'>> | null;
  builtinSymbolSources?: string[];
  symbolSources?: string;
  stats?: TimeseriesValue[];
  transactionStats?: TimeseriesValue[];
  latestRelease?: Release;
  options?: Record<string, boolean | string>;
  sessionStats?: {
    currentCrashFreeRate: number | null;
    previousCrashFreeRate: number | null;
    hasHealthData: boolean;
  };
} & AvatarProject;

export type MinimalProject = Pick<Project, 'id' | 'slug' | 'platform'>;

// Response from project_keys endpoints.
export type ProjectKey = {
  id: string;
  name: string;
  label: string;
  public: string;
  secret: string;
  projectId: string;
  isActive: boolean;
  rateLimit: {
    window: string;
    count: number;
  } | null;
  dsn: {
    secret: string;
    public: string;
    csp: string;
    security: string;
    minidump: string;
    unreal: string;
    cdn: string;
  };
  browserSdkVersion: string;
  browserSdk: {
    choices: [key: string, value: string][];
  };
  dateCreated: string;
};

export type ProjectSdkUpdates = {
  projectId: string;
  sdkName: string;
  sdkVersion: string;
  suggestions: SDKUpdatesSuggestion[];
};

export type Environment = {
  id: string;
  displayName: string;
  name: string;

  // XXX: Provided by the backend but unused due to `getUrlRoutingName()`
  // urlRoutingName: string;
};

export type TeamWithProjects = Team & {projects: Project[]};

export type PlatformIntegration = {
  id: string;
  type: string;
  language: string;
  link: string | null;
  name: string;
};
