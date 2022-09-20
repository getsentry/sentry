import type {BreadcrumbLevelType, Crumb} from 'sentry/types/breadcrumbs';

export const getLogLevels = (breadcrumbs: Crumb[]) =>
  Array.from(
    new Set<BreadcrumbLevelType>(breadcrumbs.map(breadcrumb => breadcrumb.level))
  );
