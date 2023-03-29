import {Crumb} from 'sentry/types/breadcrumbs';

export type BreadcrumbMeta = Record<any, any>;

export type BreadcrumbWithMeta = {
  breadcrumb: Crumb;
  meta: BreadcrumbMeta;
};
