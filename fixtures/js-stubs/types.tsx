import {EntryException} from 'sentry/types';
import type {
  ReplayListRecord,
  ReplayRecord,
  ReplaySpan,
} from 'sentry/views/replays/types';

import type * as BreadcrumbFrameData from './replayBreadcrumbFrameData';
import type * as ReplayFrameEvents from './replayFrameEvents';
import type * as ReplaySpanFrameData from './replaySpanFrameData';

type SimpleStub<T = any> = () => T;

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type OverridableStub<Params = any, Result = Params> = (
  params?: Partial<Params>
) => Result;

type OverridableStubList<Params = any, Result = Params> = (
  params?: Array<Partial<Params>>
) => Result[];

type TestStubFixtures = {
  AccessRequest: OverridableStub;
  AccountAppearance: OverridableStub;
  AccountEmails: OverridableStubList;
  ActivityFeed: OverridableStub;
  AllAuthenticators: SimpleStub;
  ApiApplication: OverridableStub;
  ApiKey: OverridableStub;
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
  BlurFrame: typeof BreadcrumbFrameData.BlurFrame;
  Breadcrumb: OverridableStub;
  BreadcrumbFrame: typeof ReplayFrameEvents.BreadcrumbFrame;
  BreadcrumbFrameEvent: typeof ReplayFrameEvents.BreadcrumbFrameEvent;
  Broadcast: OverridableStub;
  BuiltInSymbolSources: OverridableStubList;
  ClickFrame: typeof BreadcrumbFrameData.ClickFrame;
  CodeOwner: OverridableStub;
  Commit: OverridableStub;
  CommitAuthor: OverridableStub;
  Config: OverridableStub;
  ConsoleFrame: typeof BreadcrumbFrameData.ConsoleFrame;
  DataScrubbingRelayPiiConfig: SimpleStub;
  DebugFile: OverridableStub;
  DebugSymbols: OverridableStub;
  DetailedEvents: SimpleStub;
  DiscoverSavedQuery: OverridableStub;
  DocIntegration: OverridableStub;
  Entries: SimpleStub;
  Environments: OverridableStub;
  Event: OverridableStub;
  EventAttachment: OverridableStub;
  EventEntry: OverridableStub;
  EventEntryDebugMeta: OverridableStub;
  EventEntryExceptionGroup: SimpleStub<EntryException>;
  EventEntryStacktrace: OverridableStub;
  EventIdQueryResult: OverridableStub;
  EventStacktraceException: OverridableStub;
  EventStacktraceMessage: OverridableStub;
  Events: OverridableStubList;
  EventsStats: OverridableStub;
  ExceptionWithMeta: OverridableStubList;
  ExceptionWithRawStackTrace: OverridableStub;
  FetchFrame: typeof BreadcrumbFrameData.FetchFrame;
  FocusFrame: typeof BreadcrumbFrameData.FocusFrame;
  GitHubIntegration: OverridableStub;
  GitHubIntegrationConfig: SimpleStub;
  GitHubIntegrationProvider: OverridableStub;
  GitHubRepositoryProvider: OverridableStub;
  GlobalSelection: OverridableStub;
  Group: OverridableStub;
  GroupStats: OverridableStub;
  GroupingConfigs: SimpleStub;
  GroupingEnhancements: SimpleStub;
  Groups: SimpleStub;
  HistoryData: typeof ReplaySpanFrameData.HistoryData;
  Incident: OverridableStub;
  IncidentActivity: OverridableStub;
  IncidentStats: OverridableStub;
  IncidentTrigger: OverridableStub;
  InputFrame: typeof BreadcrumbFrameData.InputFrame;
  InstallWizard: OverridableStub;
  JiraIntegration: OverridableStub;
  JiraIntegrationProvider: OverridableStub;
  KeyboardEventFrame: typeof BreadcrumbFrameData.KeyboardEventFrame;
  LargestContentfulPaintData: typeof ReplaySpanFrameData.LargestContentfulPaintData;
  Member: OverridableStub;
  Members: OverridableStubList;
  MemoryData: typeof ReplaySpanFrameData.MemoryData;
  MetricRule: OverridableStub;
  MetricsField: OverridableStub;
  MetricsMeta: OverridableStub;
  MetricsSessionUserCountByStatusByRelease: SimpleStub;
  MetricsTotalCountByReleaseIn24h: SimpleStub;
  MutationFrame: typeof BreadcrumbFrameData.MutationFrame;
  NavigationData: typeof ReplaySpanFrameData.NavigationData;
  NetworkRequestData: typeof ReplaySpanFrameData.NetworkRequestData;
  OptionFrame: typeof ReplayFrameEvents.OptionFrame;
  OptionFrameEvent: typeof ReplayFrameEvents.OptionFrameEvent;
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
  PaintData: typeof ReplaySpanFrameData.PaintData;
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
  ReplayError: OverridableStub;
  ReplayList: OverridableStubList<ReplayListRecord>;
  ReplayRRWebDivHelloWorld: OverridableStub;
  ReplayRRWebNode: OverridableStub;
  ReplayRecord: OverridableStub<ReplayRecord>;
  ReplaySegmentBreadcrumb: OverridableStub;
  ReplaySegmentConsole: OverridableStub;
  ReplaySegmentFullsnapshot: OverridableStub;
  ReplaySegmentInit: OverridableStub;
  ReplaySegmentNavigation: OverridableStub;
  ReplaySegmentSpan: OverridableStub;
  ReplaySpanPayload: OverridableStub<
    Overwrite<ReplaySpan, {endTimestamp: Date; startTimestamp: Date}>,
    ReplaySpan
  >;
  ReplaySpanPayloadNavigate: OverridableStub<
    Overwrite<ReplaySpan, {endTimestamp: Date; startTimestamp: Date}>,
    ReplaySpan
  >;
  Repository: OverridableStub;
  RepositoryProjectPathConfig: OverridableStub;
  ResourceData: typeof ReplaySpanFrameData.ResourceData;
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
  SessionsField: OverridableStub;
  SesssionTotalCountByReleaseIn24h: SimpleStub;
  ShortIdQueryResult: OverridableStub;
  SlowClickFrame: typeof BreadcrumbFrameData.SlowClickFrame;
  SourceMapArchive: OverridableStub;
  SourceMapArtifact: OverridableStub;
  SourceMapsDebugIDBundles: OverridableStub;
  SourceMapsDebugIDBundlesArtifacts: OverridableStub;
  Span: OverridableStub;
  SpanFrame: typeof ReplayFrameEvents.SpanFrame;
  SpanFrameEvent: typeof ReplayFrameEvents.SpanFrameEvent;
  Subscriptions: OverridableStubList;
  TagValues: OverridableStubList;
  Tags: OverridableStubList;
  Team: OverridableStub;
  TeamAlertsTriggered: SimpleStub;
  TeamIssuesBreakdown: SimpleStub;
  TeamIssuesReviewed: SimpleStub;
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
  XhrFrame: typeof BreadcrumbFrameData.XhrFrame;

  // TODO: These need propertly typed still
  // Widget(queries = {...DEFAULT_QUERIES}, options)
  // Dashboard(widgets = DEFAULT_WIDGETS, props = {})
  // AsanaAutocomplete(type = 'project', values = [DEFAULT_AUTOCOMPLETE])
  // PhabricatorAutocomplete(type = 'project', values = null)
  // RoleList(params = [], fullAccess = false)

  // const MOCK_RESP_VERBOSE
  // const MOCK_RESP_ONLY_IGNORED_CONDITIONS_INVALID
  // const MOCK_RESP_INCONSISTENT_PLACEHOLDERS
  // const MOCK_RESP_INCONSISTENT_INTERVALS
};

export default TestStubFixtures;
