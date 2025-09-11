import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const FEEDBACK_BASE_PATHNAME = 'issues/feedback';

export function makeFeedbackPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    `/organizations/${organization.slug}/${FEEDBACK_BASE_PATHNAME}${path}`
  );
}
