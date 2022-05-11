import type {RawCrumb} from 'sentry/types/breadcrumbs';

/**
 * This is what we are assuming are exceptions in breadcrumbs. This differs from
 * the treatment in the Breadcrumbs component in Issue Details because that
 * component creates a crumb from the exception event itself and not from the
 * raw breadcrumb.
 */
export default function isErrorCrumb(crumb: RawCrumb) {
  return crumb.category === 'sentry.event' && crumb.level === 'error';
}
