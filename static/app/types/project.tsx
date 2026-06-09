import type {ProjectStats, SeerNightshiftTweaks} from 'sentry/types/projectBase';

import type {Scope} from './core';
import type {SDKUpdatesSuggestion} from './event';
import type {Plugin} from './integrations';
import type {Organization, Team} from './organization';
import type {PlatformKey} from './platform';
import type {Deploy} from './release';
import type {DynamicSamplingBias} from './sampling';

// Minimal project representation for use with avatars.
export type AvatarProject = {
  slug: string;
  id?: string | number;
  platform?: PlatformKey;
};

/**
 * Matches the response from `ProjectSummarySerializer` used by
 * `GET /organizations/{org}/projects/`.
 *
 * This is what `ProjectsStore`, `useProjects`, and the bootstrap requests hold.
 * Optional fields like `stats`, `transactionStats`, and `sessionStats` are only
 * present when the corresponding query params (`statsPeriod`, etc.) are passed.
 * `latestDeploys` is excluded when `collapse=latestDeploys` is sent.
 */
interface ProjectSummary extends AvatarProject {
  access: Scope[];
  dateCreated: string;
  environments: string[];
  features: string[];
  firstEvent: string | null;
  firstTransactionEvent: boolean;
  hasAccess: boolean;
  hasFeedbacks: boolean;
  hasFlags: boolean;
  hasInsightsAgentMonitoring: boolean;
  hasInsightsAppStart: boolean;
  hasInsightsAssets: boolean;
  hasInsightsCaches: boolean;
  hasInsightsDb: boolean;
  hasInsightsHttp: boolean;
  hasInsightsMCP: boolean;
  hasInsightsQueues: boolean;
  hasInsightsScreenLoad: boolean;
  hasInsightsVitals: boolean;
  hasLogs: boolean;
  hasMinifiedStackTrace: boolean;
  hasMonitors: boolean;
  hasNewFeedbacks: boolean;
  hasProfiles: boolean;
  hasReplays: boolean;
  hasSessions: boolean;
  hasTraceMetrics: boolean;
  id: string;
  isBookmarked: boolean;
  isMember: boolean;
  name: string;
  platforms: PlatformKey[];
  team: Team;
  teams: Team[];
  hasUserReports?: boolean;
  latestDeploys?: Record<string, Pick<Deploy, 'dateFinished' | 'version'>> | null;
  latestRelease?: {version: string} | null;
  organization?: Pick<Organization, 'id' | 'slug'>;
  sessionStats?: {
    currentCrashFreeRate: number | null;
    hasHealthData: boolean;
    previousCrashFreeRate: number | null;
  };
  stats?: ProjectStats;
  transactionStats?: ProjectStats;
}

/**
 * Matches `ProjectSummarySerializer` when callers request project option
 * expansion from `GET /organizations/{org}/projects/` using one or more
 * `options` query params.
 *
 * The `options` field is omitted unless requested and may still be empty when
 * none of the requested options have been set for the project.
 */
export interface ProjectSummaryWithOptions extends ProjectSummary {
  options?: Record<string, unknown>;
}

/**
 * Matches the response from `DetailedProjectSerializer` used by
 * `GET /projects/{org}/{project}/`.
 *
 * The `organization` field can be collapsed to `{id, slug}` with
 * `collapse=organization`.
 */
export interface DetailedProject extends ProjectSummary {
  allowedDomains: string[];
  dataScrubber: boolean;
  dataScrubberDefaults: boolean;
  derivedGroupingEnhancements: string;
  digestsMaxDelay: number;
  digestsMinDelay: number;
  dynamicSamplingBiases: DynamicSamplingBias[] | null;
  fingerprintingRules: string;
  groupingConfig: string;
  groupingEnhancements: string;
  isInternal: boolean;
  organization: Pick<Organization, 'id' | 'slug'>;
  plugins: Plugin[];
  processingIssues: number;
  relayPiiConfig: string;
  resolveAge: number;
  safeFields: string[];
  scrapeJavaScript: boolean;
  scrubIPAddresses: boolean;
  sensitiveFields: string[];
  storeCrashReports: number | null;
  subjectTemplate: string;
  verifySSL: boolean;
  attachmentsRole?: string | null;
  autofixAutomationTuning?: 'off' | 'super_low' | 'low' | 'medium' | 'high' | 'always';
  builtinSymbolSources?: string[];
  debugFilesRole?: string | null;
  defaultEnvironment?: string;
  highlightContext?: Record<string, string[]>;
  highlightPreset?: {
    context: Record<string, string[]>;
    tags: string[];
  };
  highlightTags?: string[];
  options?: Record<string, boolean | string>;
  preprodDistributionEnabledByCustomer?: boolean;
  preprodDistributionEnabledQuery?: string | null;
  preprodDistributionPrCommentsEnabledByCustomer?: boolean;
  preprodSizeEnabledByCustomer?: boolean;
  preprodSizeEnabledQuery?: string | null;
  preprodSizeStatusChecksEnabled?: boolean;
  preprodSizeStatusChecksRules?: unknown[];
  preprodSnapshotPrCommentsEnabled?: boolean;
  preprodSnapshotPrCommentsPostOnAdded?: boolean;
  preprodSnapshotPrCommentsPostOnChanged?: boolean;
  preprodSnapshotPrCommentsPostOnRemoved?: boolean;
  preprodSnapshotPrCommentsPostOnRenamed?: boolean;
  preprodSnapshotStatusChecksEnabled?: boolean;
  preprodSnapshotStatusChecksFailOnAdded?: boolean;
  preprodSnapshotStatusChecksFailOnChanged?: boolean;
  preprodSnapshotStatusChecksFailOnRemoved?: boolean;
  preprodSnapshotStatusChecksFailOnRenamed?: boolean;
  scmSourceContextEnabled?: boolean;
  securityToken?: string;
  securityTokenHeader?: string;
  seerNightshiftTweaks?: SeerNightshiftTweaks | null;
  seerScannerAutomation?: boolean;
  subjectPrefix?: string;
  symbolSources?: string;
  tempestFetchScreenshots?: boolean;
}

export type Project = ProjectSummary;

export type MinimalProject = Pick<ProjectSummary, 'id' | 'slug' | 'platform'>;

export type ProjectSdkUpdates = {
  projectId: string;
  sdkName: string;
  sdkVersion: string;
  suggestions: SDKUpdatesSuggestion[];
};

export interface TeamWithProjects extends Team {
  projects: Project[];
}

export type PlatformIntegration = {
  id: PlatformKey;
  language: string;
  link: string | null;
  name: string;
  type: string;
  deprecated?: boolean;
  iconConfig?: {
    withLanguageIcon: boolean;
  };
};
