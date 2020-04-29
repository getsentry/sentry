import {Breadcrumb} from './types';

function convertBreadcrumbType(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.level) {
    if (breadcrumb.level === 'warning') {
      return {
        ...breadcrumb,
        type: 'warning',
      };
    }

    if (breadcrumb.level === 'error') {
      return {
        ...breadcrumb,
        type: 'error',
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
        type: 'ui',
      };
    }

    if (category === 'console' || category === 'navigation') {
      return {
        ...breadcrumb,
        type: 'debug',
      };
    }

    if (
      category === 'sentry' &&
      (subcategory === 'transaction' || subcategory === 'event')
    ) {
      return {
        ...breadcrumb,
        type: 'error',
      };
    }
  }

  return breadcrumb;
}

export default convertBreadcrumbType;
