import {EntryException} from 'sentry/types';

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
  Member: OverridableStub;
  Members: OverridableStubList;
  MetricRule: OverridableStub;
  OrgRoleList: OverridableStub;
  PageFilters: OverridableStub;
  PlatformExternalIssue: OverridableStub;
  Plugin: OverridableStub;
  Plugins: OverridableStubList;
  Project: OverridableStub;
  ProjectAlertRule: OverridableStub;
  ProjectKeys: OverridableStubList;
  Release: (params?: any, healthParams?: any) => any;
  Repository: OverridableStub;
  SentryApp: OverridableStub;
  SentryAppComponent: OverridableStub;
  SentryAppComponentAsync: OverridableStub;
  SentryAppComponentDependent: OverridableStub;
  SentryAppInstallation: OverridableStub;
  Team: OverridableStub;
  User: OverridableStub;
  Widget: OverridableVariadicStub;

  // TODO: These need propertly typed still
  // Widget(queries = {...DEFAULT_QUERIES}, options)
  // Dashboard(widgets = DEFAULT_WIDGETS, props = {})
};

export default TestStubFixtures;
