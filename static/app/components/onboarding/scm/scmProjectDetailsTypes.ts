import type {AlertRuleOptions} from 'sentry/views/projectInstall/issueAlertOptions';
import type {NotificationSelection} from 'sentry/views/projectInstall/messagingIntegrationTypes';

export interface ProjectDetailsFormState {
  alertRuleConfig?: AlertRuleOptions;
  notificationSelection?: NotificationSelection;
  projectName?: string;
  teamSlug?: string;
  wasNameManuallyModified?: boolean;
}
