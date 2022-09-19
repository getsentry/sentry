import type {Crumb} from 'sentry/types/breadcrumbs';

export const getLogLevels = (breadcrumbs: Crumb[]) =>
  Array.from(new Set<string>(breadcrumbs.map(breadcrumb => breadcrumb.level)));
