import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

const REPLAYS_BASE_PATHNAME = 'explore/replays';

export function makeReplaysPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(
    `/organizations/${organization.slug}/${REPLAYS_BASE_PATHNAME}${path}`
  );
}
