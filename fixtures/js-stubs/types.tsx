import {EntryException} from 'sentry/types';
import type {
  ReplayError,
  ReplayListRecord,
  ReplayRecord,
} from 'sentry/views/replays/types';

import type {Replay} from './replay';

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
  ApiToken: OverridableStub;
  AvailableNotificationActions: OverridableStub;
  CodeOwner: OverridableStub;
  Config: OverridableStub;
  Dashboard: OverridableVariadicStub;
  DocIntegration: OverridableStub;
  Environments: SimpleStub;
  Event: OverridableStub;
  EventEntry: OverridableStub;
  EventEntryDebugMeta: OverridableStub;
  EventEntryExceptionGroup: SimpleStub<EntryException>;
  EventStacktraceException: OverridableStub;
  Frame: OverridableStub;
  GitHubIntegration: OverridableStub;
  Group: OverridableStub;
  Incident: OverridableStub;
  JiraIntegration: OverridableStub;
  Member: OverridableStub;
  Members: OverridableStubList;
  MetricRule: OverridableStub;
  OrgRoleList: OverridableStub;
  Organization: OverridableStub;
  PageFilters: OverridableStub;
  PlatformExternalIssue: OverridableStub;
  Plugin: OverridableStub;
  Plugins: OverridableStubList;
  Project: OverridableStub;
  ProjectAlertRule: OverridableStub;
  ProjectKeys: OverridableStubList;
  Release: (params?: any, healthParams?: any) => any;
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
