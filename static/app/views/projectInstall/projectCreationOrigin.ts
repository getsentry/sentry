import {useEffect} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Top-of-funnel attribution for /projects/new/: how the *journey* started,
 * orthogonal to SCM/legacy `variant` and to the back-nav `referrer` autofill
 * marker. Sticky for the browser tab so back-from-getting-started does not
 * reclassify an org-activation visit as existing-org.
 *
 * Seed: org-create redirects with `?projectCreationOrigin=org_creation` (must
 * be a URL param — full page reload, often cross-subdomain onto a customer
 * domain, so storage set on the signup host would not survive). On first
 * create-page paint we copy the seed into sessionStorage on *this* origin.
 * Subsequent create mounts (including autofill returns) read storage.
 */
export type ProjectCreationPageOrigin = 'org_creation' | 'existing_org';

/** Query key used only as a one-shot seed on the org-create → create hop. */
export const PROJECT_CREATION_ORIGIN_QUERY_KEY = 'projectCreationOrigin';

/** Only seed value we write today. Absent / anything else → existing_org. */
export const PROJECT_CREATION_ORIGIN_ORG_CREATION = 'org_creation';

/**
 * Pure read: resolve journey origin from the seed query value, falling back to
 * the sticky sessionStorage value, then `existing_org`. No side effects — the
 * sticky write lives in {@link useProjectCreationPageOrigin} so render stays
 * pure. Safe to call during render.
 */
export function resolveProjectCreationPageOrigin({
  orgSlug,
  queryValue,
}: {
  orgSlug: string;
  queryValue: string | undefined;
}): ProjectCreationPageOrigin {
  if (queryValue === PROJECT_CREATION_ORIGIN_ORG_CREATION) {
    return 'org_creation';
  }

  try {
    const sticky = sessionStorageWrapper.getItem(`project-creation-origin:${orgSlug}`);
    if (sticky === PROJECT_CREATION_ORIGIN_ORG_CREATION) {
      return 'org_creation';
    }
  } catch {
    // Fall through to existing_org.
  }

  return 'existing_org';
}

/**
 * Resolve the sticky project-creation journey origin for page-view analytics.
 * Reads the org-create seed, stickies it into tab sessionStorage in an effect
 * (keeping render pure and avoiding a StrictMode double-write), and resolves
 * seed → storage → `existing_org`. A back-from-getting-started visit that only
 * carries `referrer=getting-started` therefore keeps the org-activation origin.
 */
export function useProjectCreationPageOrigin(): ProjectCreationPageOrigin {
  const organization = useOrganization();
  const location = useLocation();
  const orgSlug = organization.slug;
  const queryValue = decodeScalar(location.query[PROJECT_CREATION_ORIGIN_QUERY_KEY]);

  useEffect(() => {
    if (queryValue !== PROJECT_CREATION_ORIGIN_ORG_CREATION) {
      return;
    }
    try {
      sessionStorageWrapper.setItem(
        `project-creation-origin:${orgSlug}`,
        PROJECT_CREATION_ORIGIN_ORG_CREATION
      );
    } catch {
      // Best-effort sticky; this paint still reports org_creation from the seed.
    }
  }, [orgSlug, queryValue]);

  return resolveProjectCreationPageOrigin({orgSlug, queryValue});
}
