import type {Crumb} from 'sentry/types/breadcrumbs';

export type BreadcrumbMeta = Record<string, any>;

export interface BreadcrumbWithMeta {
  breadcrumb: Crumb;
  meta: BreadcrumbMeta;
}
