import type {Scope, TimeseriesValue} from './core';
import type {SDKUpdatesSuggestion} from './event';
import type {Plugin} from './integrations';
import type {Organization, Team} from './organization';
import type {Deploy} from './release';
import type {DynamicSamplingBias, DynamicSamplingRule} from './sampling';

// Minimal project representation for use with avatars.
export type AvatarProject = {
  slug: string;
  id?: string | number;
  platform?: PlatformKey;
};

export type Project = {
  access: Scope[];
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
  hasMinifiedStackTrace: boolean;
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

  subjectTemplate: string;
  team: Team;
  teams: Team[];
  builtinSymbolSources?: string[];
  dynamicSamplingRules?: DynamicSamplingRule[] | null;
  hasUserReports?: boolean;
  latestDeploys?: Record<string, Pick<Deploy, 'dateFinished' | 'version'>> | null;
  latestRelease?: {version: string} | null;
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
    nel: string;
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

export interface TeamWithProjects extends Team {
  projects: Project[];
}

/**
 * The type of all platforms keys.
 * Also includes platforms that cannot be created in the UI anymore.
 */
export type PlatformKey =
  | 'android'
  | 'apple-ios'
  | 'apple-macos'
  | 'apple'
  | 'bun'
  | 'capacitor'
  | 'cordova'
  | 'dart'
  | 'dotnet-aspnet'
  | 'dotnet-aspnetcore'
  | 'dotnet-awslambda'
  | 'dotnet-gcpfunctions'
  | 'dotnet-maui'
  | 'dotnet-uwp'
  | 'dotnet-winforms'
  | 'dotnet-wpf'
  | 'dotnet-xamarin'
  | 'dotnet'
  | 'electron'
  | 'elixir'
  | 'flutter'
  | 'go-echo'
  | 'go-fasthttp'
  | 'go-gin'
  | 'go-http'
  | 'go-iris'
  | 'go-martini'
  | 'go-negroni'
  | 'go'
  | 'ionic'
  | 'java-log4j2'
  | 'java-logback'
  | 'java-spring-boot'
  | 'java-spring'
  | 'java'
  | 'javascript-angular'
  | 'javascript-ember'
  | 'javascript-gatsby'
  | 'javascript-nextjs'
  | 'javascript-react'
  | 'javascript-remix'
  | 'javascript-svelte'
  | 'javascript-sveltekit'
  | 'javascript-vue'
  | 'javascript'
  | 'kotlin'
  | 'minidump'
  | 'native-qt'
  | 'native'
  | 'node-awslambda'
  | 'node-azurefunctions'
  | 'node-connect'
  | 'node-express'
  | 'node-gcpfunctions'
  | 'node-koa'
  | 'node-serverlesscloud'
  | 'node'
  | 'php-laravel'
  | 'php-symfony2'
  | 'php'
  | 'python-aiohttp'
  | 'python-asgi'
  | 'python-awslambda'
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
  | 'python-quart'
  | 'python-rq'
  | 'python-sanic'
  | 'python-serverless'
  | 'python-starlette'
  | 'python-tornado'
  | 'python-tryton'
  | 'python-wsgi'
  | 'python'
  | 'react-native'
  | 'ruby-rack'
  | 'ruby-rails'
  | 'ruby'
  | 'rust'
  | 'unity'
  | 'unreal'
  | 'other'
  // legacy platforms – not included in the create project flow
  | 'cocoa-objc'
  | 'cocoa-swift'
  | 'cocoa'
  | 'csharp'
  | 'dart-flutter'
  | 'java-android'
  | 'java-appengine'
  | 'java-log4j'
  | 'java-logging'
  | 'javascript-angularjs'
  | 'javascript-backbone'
  | 'javascript-capacitor'
  | 'javascript-cordova'
  | 'javascript-electron'
  | 'native-breakpad'
  | 'native-crashpad'
  | 'native-minidump'
  | 'objc'
  | 'perl'
  | 'php-monolog'
  | 'php-symfony'
  | 'python-azurefunctions'
  // TODO(aknaus): check if those are really platform keys and clean up
  | 'python-tracing'
  | 'node-tracing'
  | 'react-native-tracing';

export type PlatformIntegration = {
  id: PlatformKey;
  language: string;
  link: string | null;
  name: string;
  type: string;
};
