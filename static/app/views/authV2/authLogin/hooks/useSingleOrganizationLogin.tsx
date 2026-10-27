import {useEffect} from 'react';
import {useSelector} from '@tanstack/react-store';

import {ConfigStore} from 'sentry/stores/configStore';
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
  const isSingleOrganization = useSelector(
    ConfigStore.store,
    state => state.singleOrganization
  );

  useEffect(() => {
    if (!isSingleOrganization || !singleOrganizationSlug) {
      return;
    }

    if (organizationSlug === singleOrganizationSlug) {
      return;
    }

    navigate(
      {pathname: `/auth/login/${encodeURIComponent(singleOrganizationSlug)}/`},
      {replace: true}
    );
  }, [isSingleOrganization, navigate, organizationSlug, singleOrganizationSlug]);

  return isSingleOrganization;
}
