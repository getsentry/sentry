import {prefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const LEGACY_FEEDBACK_BASE_PATHNAME = 'feedback';
const FEEDBACK_BASE_PATHNAME = 'issues/feedback';

export function makeFeedbackPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    prefersStackedNav()
      ? `/organizations/${organization.slug}/${FEEDBACK_BASE_PATHNAME}${path}`
      : `/organizations/${organization.slug}/${LEGACY_FEEDBACK_BASE_PATHNAME}${path}`
  );
}
