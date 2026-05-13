import type {Scope, TimeseriesValue} from './core';
import type {SDKUpdatesSuggestion} from './event';
import type {Plugin} from './integrations';
import type {Organization, Team} from './organization';
import type {Deploy} from './release';
import type {DynamicSamplingBias} from './sampling';

export type SeerNightshiftTweaks = {
  enabled?: boolean;
  extra_triage_instructions?: string;
  intelligence_level?: 'low' | 'medium' | 'high';
  max_candidates?: number;
  reasoning_effort?: 'low' | 'medium' | 'high';
};

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
  stats?: TimeseriesValue[];
  transactionStats?: TimeseriesValue[];
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
  digestsMaxDelay: number;
  digestsMinDelay: number;
  dynamicSamplingBiases: DynamicSamplingBias[] | null;
  groupingConfig: string;
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

// Response from project_keys endpoints.
export type ProjectKey = {
  browserSdk: {
    choices: Array<[key: string, value: string]>;
  };
  browserSdkVersion: ProjectKey['browserSdk']['choices'][number][0];
  dateCreated: string;
  dsn: {
    cdn: string;
    crons: string;
    csp: string;
    integration: string;
    minidump: string;
    otlp_logs: string;
    otlp_traces: string;
    playstation: string;
    public: string;
    secret: string;
    security: string;
    unreal: string;
  };
  dynamicSdkLoaderOptions: {
    hasDebug: boolean;
    hasFeedback: boolean;
    hasLogsAndMetrics: boolean;
    hasPerformance: boolean;
    hasReplay: boolean;
  };
  id: string;
  isActive: boolean;
  label: string;
  name: string;
  projectId: number;
  public: string;
  rateLimit: {
    count: number;
    window: number;
  } | null;
  secret: string;
  useCase?: string;
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
};

export interface TeamWithProjects extends Team {
  projects: Project[];
}

/**
 * The type of all platform keys.
 * Also includes platforms that cannot be created in the UI anymore.
 */
export type PlatformKey =
  | 'android'
  | 'apple'
  | 'apple-ios'
  | 'apple-macos'
  | 'bun'
  | 'c'
  | 'capacitor'
  | 'cfml'
  | 'clojure'
  | 'cocoa'
  | 'cocoa-objc'
  | 'cocoa-swift'
  | 'cordova'
  | 'csharp'
  | 'csharp-aspnetcore'
  | 'dart'
  | 'dart-flutter'
  | 'deno'
  | 'django'
  | 'dotnet'
  | 'dotnet-aspnet'
  | 'dotnet-aspnetcore'
  | 'dotnet-awslambda'
  | 'dotnet-gcpfunctions'
  | 'dotnet-google-cloud-functions'
  | 'dotnet-maui'
  | 'dotnet-uwp'
  | 'dotnet-winforms'
  | 'dotnet-wpf'
  | 'dotnet-xamarin'
  | 'electron'
  | 'elixir'
  | 'flutter'
  | 'go'
  | 'go-echo'
  | 'go-fasthttp'
  | 'go-fiber'
  | 'go-gin'
  | 'go-http'
  | 'go-iris'
  | 'go-martini'
  | 'go-negroni'
  | 'godot'
  | 'groovy'
  | 'ionic'
  | 'java'
  | 'java-android'
  | 'java-appengine'
  | 'java-log4j'
  | 'java-log4j2'
  | 'java-logback'
  | 'java-logging'
  | 'java-spring'
  | 'java-spring-boot'
  | 'javascript'
  | 'javascript-angular'
  | 'javascript-angularjs'
  | 'javascript-astro'
  | 'javascript-backbone'
  | 'javascript-browser'
  | 'javascript-capacitor'
  | 'javascript-cordova'
  | 'javascript-electron'
  | 'javascript-ember'
  | 'javascript-gatsby'
  | 'javascript-nextjs'
  | 'javascript-nuxt'
  | 'javascript-react'
  | 'javascript-react-router'
  | 'javascript-remix'
  | 'javascript-solid'
  | 'javascript-solidstart'
  | 'javascript-svelte'
  | 'javascript-sveltekit'
  | 'javascript-tanstackstart-react'
  | 'javascript-vue'
  | 'kotlin'
  | 'minidump'
  | 'native'
  | 'native-crashpad'
  | 'native-breakpad'
  | 'native-minidump'
  | 'native-qt'
  | 'nintendo-switch'
  | 'node'
  | 'node-awslambda'
  | 'node-azurefunctions'
  | 'node-cloudflare-pages'
  | 'node-cloudflare-workers'
  | 'node-connect'
  | 'node-express'
  | 'node-fastify'
  | 'node-gcpfunctions'
  | 'node-hapi'
  | 'node-hono'
  | 'node-koa'
  | 'node-nestjs'
  | 'node-nodeawslambda'
  | 'node-nodegcpfunctions'
  | 'objc'
  | 'other'
  | 'perl'
  | 'php'
  | 'PHP'
  | 'php-laravel'
  | 'php-monolog'
  | 'php-symfony'
  | 'php-symfony2'
  | 'playstation'
  | 'powershell'
  | 'python'
  | 'python-aiohttp'
  | 'python-asgi'
  | 'python-awslambda'
  | 'python-azurefunctions'
  | 'python-bottle'
  | 'python-celery'
  | 'python-chalice'
  | 'python-django'
  | 'python-falcon'
  | 'python-fastapi'
  | 'python-flask'
  | 'python-gcpfunctions'
  | 'python-litestar'
  | 'python-pylons'
  | 'python-pymongo'
  | 'python-pyramid'
  | 'python-pythonawslambda'
  | 'python-pythonazurefunctions'
  | 'python-pythongcpfunctions'
  | 'python-pythonserverless'
  | 'python-quart'
  | 'python-rq'
  | 'python-sanic'
  | 'python-serverless'
  | 'python-starlette'
  | 'python-tornado'
  | 'python-tryton'
  | 'python-wsgi'
  | 'rails'
  | 'react'
  | 'react-native'
  | 'ruby'
  | 'ruby-rack'
  | 'ruby-rails'
  | 'rust'
  | 'scala'
  | 'swift'
  | 'switt'
  | 'unity'
  | 'unreal'
  | 'xbox';

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
