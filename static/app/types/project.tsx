import type {Scope, TimeseriesValue} from './core';
import type {SDKUpdatesSuggestion} from './event';
import type {Plugin} from './integrations';
import type {Organization, Team} from './organization';
import type {Deploy} from './release';
import type {DynamicSamplingBias} from './sampling';

// Minimal project representation for use with avatars.
export type AvatarProject = {
  slug: string;
  id?: string | number;
  platform?: PlatformKey;
};

export type Project = {
  access: Scope[];
  allowedDomains: string[];
  dateCreated: string;
  digestsMaxDelay: number;
  digestsMinDelay: number;
  dynamicSamplingBiases: DynamicSamplingBias[] | null;
  environments: string[];
  eventProcessing: {
    symbolicationDegraded: boolean;
  };
  features: string[];
  firstEvent: string | null;
  firstTransactionEvent: boolean;
  groupingAutoUpdate: boolean;
  groupingConfig: string;
  hasAccess: boolean;
  hasFeedbacks: boolean;
  hasMinifiedStackTrace: boolean;
  hasNewFeedbacks: boolean;
  hasProfiles: boolean;
  hasReplays: boolean;
  hasSessions: boolean;
  id: string;
  isBookmarked: boolean;
  isInternal: boolean;
  isMember: boolean;
  name: string;
  organization: Organization;
  plugins: Plugin[];

  processingIssues: number;
  relayPiiConfig: string;
  resolveAge: number;
  safeFields: string[];
  scrapeJavaScript: boolean;
  scrubIPAddresses: boolean;
  sensitiveFields: string[];
  subjectTemplate: string;
  team: Team;
  teams: Team[];
  verifySSL: boolean;
  builtinSymbolSources?: string[];
  defaultEnvironment?: string;
  hasUserReports?: boolean;
  latestDeploys?: Record<string, Pick<Deploy, 'dateFinished' | 'version'>> | null;
  latestRelease?: {version: string} | null;
  options?: Record<string, boolean | string>;
  securityToken?: string;
  securityTokenHeader?: string;
  sessionStats?: {
    currentCrashFreeRate: number | null;
    hasHealthData: boolean;
    previousCrashFreeRate: number | null;
  };
  stats?: TimeseriesValue[];
  subjectPrefix?: string;
  symbolSources?: string;
  transactionStats?: TimeseriesValue[];
} & AvatarProject;

export type MinimalProject = Pick<Project, 'id' | 'slug' | 'platform'>;

// Response from project_keys endpoints.
export type ProjectKey = {
  browserSdk: {
    choices: [key: string, value: string][];
  };
  browserSdkVersion: ProjectKey['browserSdk']['choices'][number][0];
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
  dynamicSdkLoaderOptions: {
    hasDebug: boolean;
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
  | 'cocoa'
  | 'cocoa-objc'
  | 'cocoa-swift'
  | 'cordova'
  | 'csharp'
  | 'csharp-aspnetcore'
  | 'dart'
  | 'dart-flutter'
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
  | 'go-gin'
  | 'go-http'
  | 'go-iris'
  | 'go-martini'
  | 'go-negroni'
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
  | 'javascript-react'
  | 'javascript-remix'
  | 'javascript-svelte'
  | 'javascript-sveltekit'
  | 'javascript-vue'
  | 'kotlin'
  | 'minidump'
  | 'native'
  | 'native-crashpad'
  | 'native-breakpad'
  | 'native-minidump'
  | 'native-qt'
  | 'node'
  | 'node-awslambda'
  | 'node-azurefunctions'
  | 'node-connect'
  | 'node-express'
  | 'node-gcpfunctions'
  | 'node-koa'
  | 'node-nodeawslambda'
  | 'node-nodegcpfunctions'
  | 'node-serverlesscloud'
  | 'objc'
  | 'other'
  | 'perl'
  | 'php'
  | 'PHP'
  | 'php-laravel'
  | 'php-monolog'
  | 'php-symfony'
  | 'php-symfony2'
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
  | 'swift'
  | 'switt'
  | 'unity'
  | 'unreal';

export type PlatformIntegration = {
  id: PlatformKey;
  language: string;
  link: string | null;
  name: string;
  type: string;
};
