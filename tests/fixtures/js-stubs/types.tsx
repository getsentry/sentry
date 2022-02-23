type SimpleStub<T = any> = () => T;

type OverridableStub<T = any> = (params?: Partial<T>) => T;

type OverridableStubList<T = any> = (params?: T[]) => T[];

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
  AuthProvider: OverridableStub;
  AuthProviders: OverridableStubList;
  Authenticators: SimpleStub;
  BitbucketIntegrationConfig: SimpleStub;
  Broadcast: OverridableStub;
  BuiltInSymbolSources: OverridableStubList;
  Commit: OverridableStub;
  CommitAuthor: OverridableStub;
  Config: OverridableStub;
  DataScrubbingRelayPiiConfig: SimpleStub;
  DebugFile: OverridableStub;
  DebugSymbols: OverridableStub;
  DetailedEvents: SimpleStub;
  DiscoverSavedQuery: OverridableStub;
  DocIntegration: OverridableStub;
  Entries: SimpleStub;
  Event: OverridableStub;
  EventEntry: OverridableStub;
  EventEntryDebugMeta: OverridableStub;
  EventEntryStacktrace: OverridableStub;
  EventIdQueryResult: OverridableStub;
  EventStacktraceException: OverridableStub;
  EventStacktraceMessage: OverridableStub;
  Events: OverridableStubList;
  EventsStats: OverridableStub;
  ExceptionWithMeta: OverridableStubList;
  GitHubIntegration: OverridableStub;
  GitHubIntegrationProvider: OverridableStub;
  GitHubRepositoryProvider: OverridableStub;
  GithubIntegrationConfig: SimpleStub;
  GlobalSelection: OverridableStub;
  Group: OverridableStub;
  GroupStats: OverridableStub;
  GroupingConfigs: SimpleStub;
  GroupingEnhancements: SimpleStub;
  Groups: SimpleStub;
  Incident: OverridableStub;
  IncidentActivity: OverridableStub;
  IncidentRule: OverridableStub;
  IncidentStats: OverridableStub;
  IncidentTrigger: OverridableStub;
  InstallWizard: OverridableStub;
  JiraIntegration: OverridableStub;
  JiraIntegrationProvider: OverridableStub;
  Member: OverridableStub;
  Members: OverridableStubList;
  MetricsField: OverridableStub;
  MetricsFieldByMeasurementRating: OverridableStub;
  MetricsFieldByTransactionStatus: OverridableStub;
  MetricsFieldsByMeasurementRating: OverridableStub;
  MetricsSessionUserCountByStatusByRelease: SimpleStub;
  OrgOwnedApps: SimpleStub;
  Organization: OverridableStub;
  OrganizationEvent: OverridableStub;
  OrganizationIntegrations: OverridableStub;
  Organizations: OverridableStub;
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
  Repository: OverridableStub;
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
  SessionStatusCountByProjectInPeriod: SimpleStub;
  SessionStatusCountByReleaseInPeriod: SimpleStub;
  SessionTotalCountByProjectIn24h: SimpleStub;
  SessionUserCountByStatus: SimpleStub;
  SessionUserCountByStatus2: SimpleStub;
  SessionUserCountByStatusByRelease: SimpleStub;
  SessionUserStatusCountByProjectInPeriod: SimpleStub;
  SessionUserStatusCountByReleaseInPeriod: SimpleStub;
  SesssionTotalCountByReleaseIn24h: SimpleStub;
  ShortIdQueryResult: OverridableStub;
  SourceMapArchive: OverridableStub;
  SourceMapArtifact: OverridableStub;
  Subscriptions: OverridableStubList;
  TagValues: OverridableStubList;
  Tags: OverridableStubList;
  Team: OverridableStub;
  TeamAlertsTriggered: SimpleStub;
  TeamIssuesBreakdown: SimpleStub;
  TeamIssuesReviewed: SimpleStub;
  TeamResolutionTime: SimpleStub;
  Tombstones: OverridableStubList;
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

  // TODO: These need propertly typed still

  // Widget(queries = {...DEFAULT_QUERIES}, options)
  // Environments(hidden)
  // Dashboard(widgets = DEFAULT_WIDGETS, props = {})
  // AsanaAutocomplete(type = 'project', values = [DEFAULT_AUTOCOMPLETE])
  // PhabricatorAutocomplete(type = 'project', values = null)
  // RepositoryProjectPathConfig(project, repo, integration, params)
  // RoleList(params = [], fullAccess = false)

  // const MOCK_RESP_VERBOSE
  // const MOCK_RESP_ONLY_IGNORED_CONDITIONS_INVALID
  // const MOCK_RESP_INCONSISTENT_PLACEHOLDERS
  // const MOCK_RESP_INCONSISTENT_INTERVALS
};

export default TestStubFixtures;
