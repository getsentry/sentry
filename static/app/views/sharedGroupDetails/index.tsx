import {useLayoutEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import NotFound from 'sentry/components/errors/notFound';
import {BorderlessEventEntries} from 'sentry/components/events/eventEntries';
import Footer from 'sentry/components/footer';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useParams} from 'sentry/utils/useParams';
import {OrganizationContext} from 'sentry/views/organizationContext';

import SharedGroupHeader from './sharedGroupHeader';

function SharedGroupDetails() {
  const {shareId, orgId} = useParams();
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
  } = useApiQuery<Group>([`/organizations/${orgSlug}/shared/issues/${shareId}/`], {
    staleTime: 0,
    enabled: !!orgSlug,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (!group || !orgSlug) {
    return <NotFound />;
  }

  // project.organization is not a real organization, it's just the slug and name
  // Add the features array to avoid errors when using OrganizationContext
  const org = {...group.project.organization, features: []};

  return (
    <SentryDocumentTitle noSuffix title={group?.title ?? 'Sentry'}>
      <OrganizationContext value={org}>
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
                <Container className="group-overview event-details-container">
                  <BorderlessEventEntries
                    organization={org}
                    group={group}
                    event={group.latestEvent}
                    project={group.project}
                    isShare
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

const Container = styled('div')`
  padding: ${space(4)};
`;

export default SharedGroupDetails;
