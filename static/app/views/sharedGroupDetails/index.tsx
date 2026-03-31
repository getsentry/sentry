import {useLayoutEffect, useMemo} from 'react';

import {Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {NotFound} from 'sentry/components/errors/notFound';
import {Footer} from 'sentry/components/footer';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization, SharedViewOrganization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useParams} from 'sentry/utils/useParams';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {SharedEventContent} from './sharedEventContent';
import {SharedGroupHeader} from './sharedGroupHeader';

function SharedGroupDetails() {
  const {shareId, orgId} = useParams<{orgId: string | undefined; shareId: string}>();
  useLayoutEffect(() => {
    document.body.classList.add('shared-group');
    return () => {
      document.body.classList.remove('shared-group');
    };
  }, []);

  const orgSlug = useMemo(() => {
    if (orgId) {
      return orgId;
    }
    const {customerDomain} = window.__initialData || {};
    if (customerDomain?.subdomain) {
      return customerDomain.subdomain;
    }
    return null;
  }, [orgId]);

  const {
    data: group,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<Group>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/shared/issues/$shareId/`, {
        path: {organizationIdOrSlug: orgSlug!, shareId},
      }),
    ],
    {
      staleTime: 0,
      enabled: !!orgSlug,
    }
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (!group || !orgSlug) {
    return <NotFound />;
  }

  // Backend only provides {slug, name} for the organization.
  // Add features: [] for OrganizationContext compatibility.
  const org: SharedViewOrganization = {
    ...group.project.organization,
    features: [],
  };

  return (
    <SentryDocumentTitle noSuffix title={group?.title ?? 'Sentry'}>
      <OrganizationContext value={org as Organization}>
        <div className="app">
          <div className="pattern-bg" />
          <div className="container">
            <div className="box box-modal">
              <div className="box-header">
                <Link className="logo" to="/">
                  <span className="icon-sentry-logo-full" />
                </Link>
                {group.permalink && (
                  <Link className="details" to={group.permalink}>
                    {t('Details')}
                  </Link>
                )}
              </div>
              <div className="box-content">
                <SharedGroupHeader group={group} />
                <Container
                  padding="3xl"
                  className="group-overview event-details-container"
                >
                  <SharedEventContent
                    organization={org}
                    group={group}
                    event={group.latestEvent}
                    project={group.project}
                  />
                </Container>
                <Footer />
              </div>
            </div>
          </div>
        </div>
      </OrganizationContext>
    </SentryDocumentTitle>
  );
}

export default SharedGroupDetails;
