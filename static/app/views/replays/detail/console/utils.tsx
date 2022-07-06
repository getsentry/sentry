import {BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';

export const filterBreadcrumbs = (
  breadcrumbs: BreadcrumbTypeDefault[],
  searchTerm: string,
  logLevel: Array<string>
) => {
  if (!searchTerm && logLevel.length === 0) {
    return breadcrumbs;
  }
  return breadcrumbs.filter(breadcrumb => {
    const normalizedSearchTerm = searchTerm.toLowerCase();
    const doesMatch = JSON.stringify(breadcrumb.data)
      .toLowerCase()
      .includes(normalizedSearchTerm);
    if (logLevel.length > 0) {
      return doesMatch && logLevel.includes(breadcrumb.level);
    }
    return doesMatch;
  });
};
