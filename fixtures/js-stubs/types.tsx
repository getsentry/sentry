import {EntryException, ReleaseMeta} from 'sentry/types';
import type {
  ReplayError,
  ReplayListRecord,
  ReplayRecord,
} from 'sentry/views/replays/types';

import type {Replay} from './replay';
import {MockRuleCondition} from './ruleConditions';

type SimpleStub<T = any> = () => T;

type OverridableStub<Params = any, Result = Params> = (
  params?: Partial<Params>
) => Result;

type OverridableVariadicStub<Params = any, Result = Params> = (
  ...params: Array<Partial<Params>>
) => Result;

type OverridableStubList<Params = any, Result = Params> = (
  params?: Array<Partial<Params>>
) => Result[];

type TestStubFixtures = {
  AccessRequest: OverridableStub;
  AccountEmails: OverridableStubList;
  ActivityFeed: OverridableStub;
  AllAuthenticators: SimpleStub;
  ApiApplication: OverridableStub;
  ApiToken: OverridableStub;
  AsanaCreate: SimpleStub;
  AsanaPlugin: SimpleStub;
  AuditLogs: OverridableStubList;
  AuditLogsApiEventNames: SimpleStub;
  AuthProvider: OverridableStub;
  AuthProviders: OverridableStubList;
  Authenticators: SimpleStub;
  AvailableNotificationActions: OverridableStub;
  BitbucketIntegrationConfig: SimpleStub;
  Breadcrumb: OverridableStub;
  Broadcast: OverridableStub;
  BuiltInSymbolSources: OverridableStubList;
  CodeOwner: OverridableStub;
  Commit: OverridableStub;
  CommitAuthor: OverridableStub;
  Config: OverridableStub;
  Dashboard: OverridableVariadicStub;
  DataScrubbingRelayPiiConfig: SimpleStub;
  DebugFile: OverridableStub;
  DebugSymbols: OverridableStub;
  DeprecatedApiKey: OverridableStub;
  DetailedEvents: SimpleStub;
  DiscoverSavedQuery: OverridableStub;
  DocIntegration: OverridableStub;
  Entries: SimpleStub;
  Entries123Base: OverridableStub;
  Entries123Target: OverridableStub;
  Environments: SimpleStub;
  Event: OverridableStub;
  EventAttachment: OverridableStub;
  EventEntry: OverridableStub;
  EventEntryDebugMeta: OverridableStub;
  EventEntryExceptionGroup: SimpleStub<EntryException>;
  EventEntryStacktrace: OverridableStub;
  EventIdQueryResult: OverridableStub;
  EventStacktraceException: OverridableStub;
  EventStacktraceMessage: OverridableStub;
  EventsStats: OverridableStub;
  ExceptionWithRawStackTrace: OverridableStub;
  Frame: OverridableStub;
  GitHubIntegration: OverridableStub;
  GitHubIntegrationConfig: SimpleStub;
  GitHubIntegrationProvider: OverridableStub;
  GlobalSelection: OverridableStub;
  Group: OverridableStub;
  GroupStats: OverridableStub;
  GroupingConfigs: SimpleStub;
  Groups: SimpleStub;
  HiddenEnvironments: SimpleStub;
  Incident: OverridableStub;
  IncidentActivity: OverridableStub;
  IncidentStats: OverridableStub;
  IncidentTrigger: OverridableStub;
  InstallWizard: OverridableStub;
  JiraIntegration: OverridableStub;
  JiraIntegrationProvider: OverridableStub;
  MOCK_RESP_INCONSISTENT_INTERVALS: MockRuleCondition;
  MOCK_RESP_INCONSISTENT_PLACEHOLDERS: MockRuleCondition;
  MOCK_RESP_ONLY_IGNORED_CONDITIONS_INVALID: MockRuleCondition;
  MOCK_RESP_PLACEHOLDERS: MockRuleCondition;
  MOCK_RESP_VERBOSE: MockRuleCondition;
  Member: OverridableStub;
  Members: OverridableStubList;
  MetricRule: OverridableStub;
  MetricsField: (field: string, params?: Partial<any>) => any;
  MetricsMeta: OverridableStub;
  MetricsSessionUserCountByStatusByRelease: SimpleStub;
  MetricsTotalCountByReleaseIn24h: SimpleStub;
  MissingMembers: OverridableStubList;
  NotificationDefaults: SimpleStub;
  OpsgenieIntegration: OverridableStub;
  OpsgenieIntegrationProvider: OverridableStub;
  OrgOwnedApps: SimpleStub;
  OrgRoleList: OverridableStub;
  Organization: OverridableStub;
  OrganizationEvent: OverridableStub;
  OrganizationIntegrations: OverridableStub;
  Organizations: OverridableStub;
  Outcomes: SimpleStub;
  OutcomesWithLowProcessedEvents: SimpleStub;
  OutcomesWithReason: SimpleStub;
  OutcomesWithoutClientDiscarded: SimpleStub;
  PageFilters: OverridableStub;
  PhabricatorCreate: SimpleStub;
  PhabricatorPlugin: SimpleStub;
  PlatformExternalIssue: OverridableStub;
  Plugin: OverridableStub;
  PluginListConfig: SimpleStub;
  Plugins: OverridableStubList;
  Project: OverridableStub;
  ProjectAlertRule: OverridableStub;
  ProjectAlertRuleConfiguration: OverridableStub;
  ProjectDetails: OverridableStub;
  ProjectFilters: OverridableStubList;
  ProjectKeys: OverridableStubList;
  ProviderList: SimpleStub;
  PublishedApps: SimpleStub;
  PullRequest: OverridableStub;
  Release: (params?: any, healthParams?: any) => any;
  ReleaseMeta: OverridableStub<ReleaseMeta>;
  Replay: typeof Replay;
  ReplayError: OverridableStub<ReplayError>;
  ReplayList: OverridableStubList<ReplayListRecord>;
  ReplayRecord: OverridableStub<ReplayRecord>;
  Repository: OverridableStub;
  RepositoryProjectPathConfig: OverridableStub;
  Search: OverridableStub;
  Searches: OverridableStubList;
  SentryApp: OverridableStub;
  SentryAppComponent: OverridableStub;
  SentryAppComponentAsync: OverridableStub;
  SentryAppComponentDependent: OverridableStub;
  SentryAppInstallation: OverridableStub;
  SentryAppInstalls: SimpleStub;
  SentryAppToken: OverridableStub;
  SentryAppWebhookRequest: OverridableStub;
  ServiceIncident: OverridableStub;
  SessionEmptyGroupedResponse: SimpleStub;
  SessionStatusCountByProjectInPeriod: SimpleStub;
  SessionStatusCountByReleaseInPeriod: SimpleStub;
  SessionTotalCountByProjectIn24h: SimpleStub;
  SessionUserCountByStatus: SimpleStub;
  SessionUserCountByStatus2: SimpleStub;
  SessionUserCountByStatusByRelease: SimpleStub;
  SessionUserStatusCountByProjectInPeriod: SimpleStub;
  SessionUserStatusCountByReleaseInPeriod: SimpleStub;
  SessionsField: (field: string) => any;
  SesssionTotalCountByReleaseIn24h: SimpleStub;
  ShortIdQueryResult: OverridableStub;
  SourceMapArchive: OverridableStub;
  SourceMapArtifact: OverridableStub;
  SourceMapsDebugIDBundles: OverridableStub;
  SourceMapsDebugIDBundlesArtifacts: OverridableStub;
  Span: OverridableStub;
  Subscriptions: OverridableStubList;
  TagValues: OverridableStubList;
  Tags: OverridableStubList;
  Team: OverridableStub;
  TeamAlertsTriggered: SimpleStub;
  TeamIssuesBreakdown: SimpleStub;
  TeamIssuesReviewed: SimpleStub;
  TeamReleaseCounts: SimpleStub;
  TeamResolutionTime: SimpleStub;
  TeamRoleList: OverridableStub;
  Tombstones: OverridableStubList;
  TraceError: OverridableStub;
  UpdateSdkAndEnableIntegrationSuggestion: SimpleStub;
  User: OverridableStub;
  UserDetails: OverridableStub;
  UserFeedback: OverridableStub;
  UserIdentity: SimpleStub;
  UserTotalCountByProjectIn24h: SimpleStub;
  UserTotalCountByReleaseIn24h: SimpleStub;
  VercelProvider: SimpleStub;
  VstsCreate: SimpleStub;
  VstsIntegrationProvider: OverridableStub;
  VstsPlugin: SimpleStub;
  Widget: OverridableVariadicStub;

  // TODO: These need propertly typed still
  // Widget(queries = {...DEFAULT_QUERIES}, options)
  // Dashboard(widgets = DEFAULT_WIDGETS, props = {})
  // AsanaAutocomplete(type = 'project', values = [DEFAULT_AUTOCOMPLETE])
  // PhabricatorAutocomplete(type = 'project', values = null)
  // RoleList(params = [], fullAccess = false)
};

export default TestStubFixtures;
