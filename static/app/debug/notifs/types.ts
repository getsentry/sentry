export type NotificationSource = string;

export interface NotificationCategory {
  label: string;
  sources: NotificationSource[];
  value: string;
}

export interface NotificationSelection {
  category: NotificationCategory;
  source: NotificationSource;
}
