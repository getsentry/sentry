import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ButtonBar from 'sentry/components/buttonBar';
import FeatureBadge from 'sentry/components/featureBadge';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

import {
  CronsLandingPanel,
  isValidGuide,
  isValidPlatform,
} from './components/cronsLandingPanel';
import {NewMonitorButton} from './components/newMonitorButton';
import {OverviewTimeline} from './components/overviewTimeline';
import {Monitor} from './types';
import {makeMonitorListQueryKey} from './utils';

export default function Monitors() {
  const organization = useOrganization();
  const router = useRouter();
  const platform = decodeScalar(router.location.query?.platform) ?? null;
  const guide = decodeScalar(router.location.query?.guide);

  const queryKey = makeMonitorListQueryKey(organization, router.location);

  const {
    data: monitorList,
    getResponseHeader: monitorListHeaders,
    isLoading,
  } = useApiQuery<Monitor[]>(queryKey, {
    staleTime: 0,
  });

  useRouteAnalyticsEventNames('monitors.page_viewed', 'Monitors: Page Viewed');
  useRouteAnalyticsParams({empty_state: !monitorList || monitorList.length === 0});

  const monitorListPageLinks = monitorListHeaders?.('Link');

  const handleSearch = (query: string) => {
    const currentQuery = {...(router.location.query ?? {}), cursor: undefined};
    router.push({
      pathname: location.pathname,
      query: normalizeDateTimeParams({...currentQuery, query}),
    });
  };

  // Only show the add monitor button if there is no currently displayed guide
  const showAddMonitor = !isValidPlatform(platform) || !isValidGuide(guide);

  return (
    <SentryDocumentTitle title={`Crons — ${organization.slug}`}>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>
              {t('Cron Monitors')}
              <PageHeadingQuestionTooltip
                title={t(
                  'Scheduled monitors that check in on recurring jobs and tell you if they’re running on schedule, failing, or succeeding.'
                )}
                docsUrl="https://docs.sentry.io/product/crons/"
              />
              <FeatureBadge type="beta" />
            </Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <FeedbackWidgetButton />
              {showAddMonitor && (
                <NewMonitorButton size="sm" icon={<IconAdd isCircled />}>
                  {t('Add Monitor')}
                </NewMonitorButton>
              )}
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <Filters>
              <PageFilterBar>
                <ProjectPageFilter resetParamsOnChange={['cursor']} />
                <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
              </PageFilterBar>
              <SearchBar
                query={decodeScalar(qs.parse(location.search)?.query, '')}
                placeholder={t('Search by name or slug')}
                onSearch={handleSearch}
              />
            </Filters>
            {isLoading ? (
              <LoadingIndicator />
            ) : monitorList?.length ? (
              <Fragment>
                <OverviewTimeline monitorList={monitorList} />
                {monitorListPageLinks && <Pagination pageLinks={monitorListPageLinks} />}
              </Fragment>
            ) : (
              <CronsLandingPanel />
            )}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const Filters = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};
`;
