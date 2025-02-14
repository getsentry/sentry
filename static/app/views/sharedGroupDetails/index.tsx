import {useLayoutEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import NotFound from 'sentry/components/errors/notFound';
import {BorderlessEventEntries} from 'sentry/components/events/eventEntries';
import Footer from 'sentry/components/footer';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useApiQuery} from 'sentry/utils/queryClient';

import {OrganizationContext} from '../organizationContext';

import SharedGroupHeader from './sharedGroupHeader';

type Props = RouteComponentProps<{shareId: string; orgId?: string}>;

function SharedGroupDetails({params}: Props) {
  useLayoutEffect(() => {
    document.body.classList.add('shared-group');
    return () => {
      document.body.classList.remove('shared-group');
    };
  }, []);

  const orgSlug = useMemo(() => {
    if (params.orgId) {
      return params.orgId;
    }
    const {customerDomain} = window.__initialData || {};
    if (customerDomain?.subdomain) {
      return customerDomain.subdomain;
    }
    return null;
  }, [params.orgId]);

  const {shareId} = params;
  const {
    data: group,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Group>(
    [
      orgSlug
        ? `/organizations/${orgSlug}/shared/issues/${shareId}/`
        : `/shared/issues/${shareId}/`,
    ],
    {
      staleTime: 0,
    }
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (!group) {
    return <NotFound />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  // project.organization is not a real organization, it's just the slug and name
  // Add the features array to avoid errors when using OrganizationContext
  const org = {...group.project.organization, features: []};

  return (
    <SentryDocumentTitle noSuffix title={group?.title ?? 'Sentry'}>
      <OrganizationContext.Provider value={org}>
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
      </OrganizationContext.Provider>
    </SentryDocumentTitle>
  );
}

const Container = styled('div')`
  padding: ${space(4)};
`;

export default SharedGroupDetails;
