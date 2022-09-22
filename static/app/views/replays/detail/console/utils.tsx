import type {BreadcrumbLevelType, Crumb} from 'sentry/types/breadcrumbs';

export const getLogLevels = (breadcrumbs: Crumb[], selected: BreadcrumbLevelType[]) =>
  Array.from(
    new Set(breadcrumbs.map(breadcrumb => breadcrumb.level).concat(selected))
  ).sort();
