import type {
  Group,
  GroupIntegration,
  Organization,
  PlatformExternalIssue,
  Project,
  SentryAppComponent,
  SentryAppInstallation,
} from 'sentry/types';
import type {Event} from 'sentry/types/event';

export type ExternalIssueType =
  | 'sentry-app-issue'
  | 'integration-issue'
  | 'plugin-issue'
  | 'plugin-action';

interface BaseIssueComponent {
  key: string;
  disabled?: boolean;
  hasLinkedIssue?: boolean;
}

export interface SentryAppIssueComponent extends BaseIssueComponent {
  props: {
    disabled: undefined | boolean;
    event: Event;
    externalIssue: PlatformExternalIssue | undefined;
    group: Group;
    organization: Organization;
    sentryApp: SentryAppComponent['sentryApp'];
    sentryAppComponent: SentryAppComponent;
    sentryAppInstallation: SentryAppInstallation;
  };
  type: 'sentry-app-issue';
}

export interface IntegrationComponent extends BaseIssueComponent {
  props: {
    configurations: GroupIntegration[];
    group: Group;
    onChange: () => void;
  };
  type: 'integration-issue';
}

export interface PluginIssueComponent extends BaseIssueComponent {
  props: {
    group: Group;
    plugin: Group['pluginIssues'][number];
    project: Project;
  };
  type: 'plugin-issue';
}

export interface PluginActionComponent extends BaseIssueComponent {
  props: {
    plugin: Group['pluginActions'][number];
  };
  type: 'plugin-action';
}

export type ExternalIssueComponent =
  | SentryAppIssueComponent
  | IntegrationComponent
  | PluginIssueComponent
  | PluginActionComponent;
