import {useEffect} from 'react';

import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {useNavigate} from 'sentry/utils/useNavigate';

interface UseSingleOrganizationLoginOptions {
  organizationSlug: string | undefined;
  singleOrganizationSlug: string | undefined;
}

export function useSingleOrganizationLogin({
  organizationSlug,
  singleOrganizationSlug,
}: UseSingleOrganizationLoginOptions) {
  const navigate = useNavigate();
  const isSingleOrganization = useLegacyStore(ConfigStore).singleOrganization;

  useEffect(() => {
    if (!isSingleOrganization || !singleOrganizationSlug) {
      return;
    }

    // Single-tenant installs also host staff organizations, so an explicit
    // organization login route must not be rewritten to the default org.
    if (organizationSlug) {
      return;
    }

    navigate(
      {pathname: `/auth/login/${encodeURIComponent(singleOrganizationSlug)}/`},
      {replace: true}
    );
  }, [isSingleOrganization, navigate, organizationSlug, singleOrganizationSlug]);

  return isSingleOrganization;
}
