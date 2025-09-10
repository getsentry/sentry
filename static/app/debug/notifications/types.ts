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

export interface NotificationTemplateRegistration {
  category: string;
  example: {
    actions: Array<{label: string; link: string}>;
    body: string;
    subject: string;
    chart?: {alt_text: string; url: string};
    footer?: string;
  };
  source: string;
}

export type NotificationTemplateRegistry = Record<
  string,
  NotificationTemplateRegistration[]
>;
