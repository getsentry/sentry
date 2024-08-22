import type {Team} from './organization';

export const enum NotificationHistoryStatus {
  READ = 'read',
  UNREAD = 'unread',
  ARCHIVED = 'archived',
}

export const enum NotificationMailboxes {
  INBOX = 'inbox',
  UNREAD = 'unread',
  ARCHIVED = 'archived',
}

export const enum NotificationType {
  DEPLOY = 'deploy',
  ISSUE_ALERTS = 'alerts',
  WORKFLOW = 'workflow',
  APPROVAL = 'approval',
  MARKETING = 'marketing',
}

export interface NotificationHistory {
  content: Record<string, any>;
  date_added: string;
  date_updated: string;
  description: string;
  id: string;
  source: NotificationType;
  status: NotificationHistoryStatus;
  title: string;
  team?: Team;
  user_id?: number;
}
