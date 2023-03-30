import {Crumb} from 'sentry/types/breadcrumbs';

export type BreadcrumbMeta = Record<string, any>;

export type BreadcrumbWithMeta = {
  breadcrumb: Crumb;
  meta: BreadcrumbMeta;
};
