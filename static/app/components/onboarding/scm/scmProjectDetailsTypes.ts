import type {NotificationSelection} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import type {AlertRuleOptions} from 'sentry/views/projectInstall/issueAlertOptions';

export interface ProjectDetailsFormState {
  alertRuleConfig?: AlertRuleOptions;
  notificationSelection?: NotificationSelection;
  projectName?: string;
  teamSlug?: string;
}
