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
/**
 * The registry maps the category to the a list of templates for that category.
 * The backend has a test to verify that each registration.category is the same category as the
 * key for this registry, but enforcing that in TS is challenging.
 */
export type NotificationTemplateRegistry = Record<
  string,
  NotificationTemplateRegistration[]
>;
