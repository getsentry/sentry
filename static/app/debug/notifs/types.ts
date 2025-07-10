export interface NotificationSource {
  category: Omit<NotificationCategory, 'sources'>;
  label: string;
  value: string;
}

export interface NotificationCategory {
  label: string;
  sources: NotificationSource[];
  value: string;
}

export interface NotificationSelection {
  category: NotificationCategory;
  source: NotificationSource;
}
