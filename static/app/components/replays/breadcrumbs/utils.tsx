import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';

/**
 * Generate breadcrumb descriptions based on type
 */
export function getDescription(crumb: Crumb) {
  if (typeof crumb.data === 'object' && crumb.data !== null && 'action' in crumb.data) {
    switch (crumb.data.action) {
      case 'largest-contentful-paint':
        if (crumb.data?.value !== undefined) {
          return `${Math.round(crumb.data.value)}ms`;
        }
        if (crumb.data?.duration !== undefined) {
          // this means user is using an old SDK where LCP values are not
          // always correct. Prompt them to upgrade
          return (
            <Tooltip
              title={t(
                'This replay uses a SDK version that is subject to inaccurate LCP values. Please upgrade to the latest version for best results if you have not already done so.'
              )}
            >
              <IconWarning />
            </Tooltip>
          );
        }
        break;
      default:
        break;
    }
  }

  switch (crumb.type) {
    case BreadcrumbType.NAVIGATION:
      return `${crumb.data?.to ?? ''}`;
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
  // Supports replay specific breadcrumbs
  if (
    typeof crumb.data === 'object' &&
    crumb.data !== null &&
    'label' in crumb.data &&
    crumb.data.label
  ) {
    return crumb.data.label;
  }

  const [type, action] = crumb.category?.split('.') || [];
  if (type === 'ui') {
    return `User ${action || ''}`;
  }
  return `${type} ${action || ''}`;
}

/**
 * Generate breadcrumb title + descriptions
 */
export function getDetails(crumb: Crumb) {
  return {title: getTitle(crumb), description: getDescription(crumb)};
}
