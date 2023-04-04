import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';

// Replay SDK can send `data` that does not conform to our issue/event breadcrumbs
type MaybeCrumbData = null | Record<string, unknown>;

/**
 * Generate breadcrumb descriptions based on type
 */
export function getDescription(crumb: Crumb) {
  const crumbData: MaybeCrumbData = crumb.data as MaybeCrumbData;

  if (crumbData && typeof crumbData === 'object' && 'action' in crumbData) {
    switch (crumbData.action) {
      case 'largest-contentful-paint':
        if (typeof crumbData?.value === 'number') {
          return `${Math.round(crumbData.value)}ms`;
        }

        if (crumbData?.duration !== undefined) {
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

  if (crumb.category === 'replay.mutations') {
    return t(
      'A large number of mutations was detected (%s). This can slow down the Replay SDK and impact your customers.',
      crumbData?.count
    );
  }

  switch (crumb.type) {
    case BreadcrumbType.NAVIGATION:
      return `${crumbData?.to ?? ''}`;
    case BreadcrumbType.DEFAULT:
      return crumbData;
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
  if (type === 'replay') {
    return `Replay`;
  }
  return `${type} ${action || ''}`;
}

/**
 * Generate breadcrumb title + descriptions
 */
export function getDetails(crumb: Crumb) {
  return {title: getTitle(crumb), description: getDescription(crumb)};
}
