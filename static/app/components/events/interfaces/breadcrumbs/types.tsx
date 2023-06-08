import {Crumb} from 'sentry/types/breadcrumbs';

export type BreadcrumbMeta = Record<string, any>;

export type BreadcrumbWithMeta = {
  breadcrumb: Crumb;
  meta: BreadcrumbMeta;
};

// Used when looking up transaction title from breadcrumb transactions
export type BreadcrumbTransactionEvent = {
  id: string;
  'project.name': string;
  title: string;
};
