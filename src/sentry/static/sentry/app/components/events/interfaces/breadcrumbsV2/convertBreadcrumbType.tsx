import {Breadcrumb, BreadcrumbType} from '../breadcrumbs/types';

function convertBreadcrumbType(breadcrumb: Breadcrumb): Breadcrumb {
  // special case for 'ui.' and `sentry.` category breadcrumbs
  // TODO: find a better way to customize UI around non-schema data
  if (
    (!breadcrumb.type || breadcrumb.type === BreadcrumbType.DEFAULT) &&
    breadcrumb.category
  ) {
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
        type: BreadcrumbType.EXCEPTION,
      };
    }
  }

  return breadcrumb;
}

export default convertBreadcrumbType;
