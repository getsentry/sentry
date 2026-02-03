import {useEffect} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {AuthProvider} from 'sentry/types/auth';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import OrganizationAuthList from './organizationAuthList';

function OrganizationAuth() {
  const organization = useOrganization();

  const {
    data: providerList,
    isLoading: loadingProviders,
    error: errorProviders,
  } = useApiQuery<AuthProvider[]>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/auth-providers/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {staleTime: 0}
  );
  const {
    data: provider,
    isLoading: loadingProvider,
    error: errorProvider,
  } = useApiQuery<AuthProvider>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/auth-provider/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {
      staleTime: 0,
    }
  );

  const shouldRedirectToProvider = provider && organization.access.includes('org:write');

  useEffect(() => {
    if (!shouldRedirectToProvider) {
      return;
    }

    // If SSO provider is configured, keep showing loading while we redirect
    // to django configuration view
    // XXX: This does not need to be normalized for customer-domains because we're going
    // to a django rendered view.
    const path = `/organizations/${organization.slug}/auth/configure/`;

    // Use replace so we don't go back to the /settings/auth and hit this path again.
    window.location.replace(path);
  }, [organization.slug, shouldRedirectToProvider]);

  if (loadingProvider || loadingProviders || shouldRedirectToProvider) {
    return <LoadingIndicator />;
  }

  if (errorProvider || errorProviders) {
    return <LoadingError />;
  }

  if (providerList === undefined) {
    return null;
  }

  const activeProvider = providerList.find(p => p.key === provider?.key);

  return (
    <SentryDocumentTitle title={t('Auth Settings')} orgSlug={organization.slug}>
      <OrganizationAuthList activeProvider={activeProvider} providerList={providerList} />
    </SentryDocumentTitle>
  );
}

export default OrganizationAuth;
