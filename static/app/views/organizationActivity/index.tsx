import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import AlertStore from 'sentry/stores/alertStore';
import {space} from 'sentry/styles/space';
import type {Activity} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import routeTitle from 'sentry/utils/routeTitle';
import useOrganization from 'sentry/utils/useOrganization';

import ActivityFeedItem from './activityFeedItem';

function OrganizationActivity() {
  const organization = useOrganization();
  const {
    data: activity,
    isLoading,
    isError,
    getResponseHeader,
  } = useApiQuery<Activity[]>([`/organizations/${organization.slug}/activity/`], {
    staleTime: 0,
  });

  AlertStore.addAlert({
    id: 'organization-activity-deprecated-x',
    message: t('This page is deprecated and will be removed in a future release.'),
    type: 'warning',
    opaque: true,
    neverExpire: true,
    noDuplicates: true,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError || (!isLoading && !activity.length)) {
    return (
      <EmptyStateWarning>
        <p>{t('Nothing to show here, move along.')}</p>
      </EmptyStateWarning>
    );
  }

  const activityPageLinks = getResponseHeader?.('Link');

  return (
    <SentryDocumentTitle title={routeTitle(t('Activity'), organization.slug, false)}>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Activity')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <Panel>
              {!isLoading && (
                <div data-test-id="activity-feed-list">
                  {activity.map(item => (
                    <ErrorBoundary
                      mini
                      css={{marginBottom: space(1), borderRadius: 0}}
                      key={item.id}
                    >
                      <ActivityFeedItem organization={organization} item={item} />
                    </ErrorBoundary>
                  ))}
                </div>
              )}
            </Panel>
            {activityPageLinks && <Pagination pageLinks={activityPageLinks} />}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

export default OrganizationActivity;
