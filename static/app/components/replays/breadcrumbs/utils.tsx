import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';

/**
 * Generate breadcrumb descriptions based on type
 */
export function getDescription(crumb: Crumb) {
  switch (crumb.type) {
    case BreadcrumbType.NAVIGATION:
      return `${crumb.data?.from ? `${crumb.data?.from} => ` : ''}${
        crumb.data?.to ?? ''
      }`;
    case BreadcrumbType.DEFAULT:
      return JSON.stringify(crumb.data);
    default:
      return crumb.message || '';
  }
}

/**
 * Get title of breadcrumb
 */
export function getTitle(crumb: Crumb) {
  const [type, action] = crumb.category?.split('.') || [];

  // Supports replay specific breadcrumbs
  if (crumb.data && 'label' in crumb.data) {
    return crumb.data.label;
  }

  return `${type === 'ui' ? 'User' : type} ${action || ''}`;
}

/**
 * Generate breadcrumb title + descriptions
 */
export function getDetails(crumb: Crumb) {
  return {title: getTitle(crumb), description: getDescription(crumb)};
}
