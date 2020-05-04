import {Breadcrumb, BreadcrumbType} from './types';

function convertBreadcrumbType(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.level) {
    if (breadcrumb.level === 'warning') {
      return {
        ...breadcrumb,
        type: BreadcrumbType.WARNING,
      };
    }

    if (breadcrumb.level === 'error') {
      return {
        ...breadcrumb,
        type: BreadcrumbType.ERROR,
      };
    }
  }
  // special case for 'ui.' and `sentry.` category breadcrumbs
  // TODO: find a better way to customize UI around non-schema data
  if ((!breadcrumb.type || breadcrumb.type === 'default') && breadcrumb.category) {
    const [category, subcategory] = breadcrumb.category.split('.');
    if (category === 'ui') {
      return {
        ...breadcrumb,
        type: BreadcrumbType.UI,
      };
    }

    if (category === 'console' || category === 'navigation') {
      return {
        ...breadcrumb,
        type: BreadcrumbType.DEBUG,
      };
    }

    if (
      category === 'sentry' &&
      (subcategory === 'transaction' || subcategory === 'event')
    ) {
      return {
        ...breadcrumb,
        type: BreadcrumbType.ERROR,
      };
    }
  }

  return breadcrumb;
}

export default convertBreadcrumbType;
