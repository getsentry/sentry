import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {
  ExternalIssue,
  GroupIntegration,
  PlatformExternalIssue,
  SentryAppComponent,
  SentryAppInstallation,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

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
    externalIssue?: ExternalIssue;
  };
  type: 'integration-issue';
}

export type ExternalIssueComponent = SentryAppIssueComponent | IntegrationComponent;
