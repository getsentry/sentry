import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {openBulkEditMonitorsModal} from 'sentry/actionCreators/modal';
import {deleteProjectProcessingErrorByType} from 'sentry/actionCreators/monitors';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconList} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import {
  CronsLandingPanel,
  isValidGuide,
  isValidPlatform,
} from './components/cronsLandingPanel';
import {NewMonitorButton} from './components/newMonitorButton';
import {OverviewTimeline} from './components/overviewTimeline';
import {OwnerFilter} from './components/ownerFilter';
import {MonitorProcessingErrors} from './components/processingErrors/monitorProcessingErrors';
import {makeMonitorListErrorsQueryKey} from './components/processingErrors/utils';
import type {CheckinProcessingError, Monitor, ProcessingErrorType} from './types';
import {makeMonitorListQueryKey} from './utils';

const CronsListPageHeader = HookOrDefault({
  hookName: 'component:crons-list-page-header',
});

export default function Monitors() {
  const api = useApi();
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const platform = decodeScalar(location.query?.platform) ?? null;
  const guide = decodeScalar(location.query?.guide);
  const project = decodeList(location.query?.project);

  const queryKey = makeMonitorListQueryKey(organization, location.query);

  const {
    data: monitorList,
    getResponseHeader: monitorListHeaders,
    isPending,
    refetch,
  } = useApiQuery<Monitor[]>(queryKey, {
    staleTime: 0,
  });

  const processingErrorQueryKey = makeMonitorListErrorsQueryKey(organization, project);
  const {data: processingErrors, refetch: refetchErrors} = useApiQuery<
    CheckinProcessingError[]
  >(processingErrorQueryKey, {
    staleTime: 0,
  });

  useRouteAnalyticsEventNames('monitors.page_viewed', 'Monitors: Page Viewed');
  useRouteAnalyticsParams({empty_state: !monitorList || monitorList.length === 0});

  const monitorListPageLinks = monitorListHeaders?.('Link');

  const handleSearch = (query: string) => {
    const currentQuery = {...(location.query ?? {}), cursor: undefined};
    navigate({
      pathname: location.pathname,
      query: normalizeDateTimeParams({...currentQuery, query}),
    });
  };

  function handleDismissError(errortype: ProcessingErrorType, projectId: string) {
    deleteProjectProcessingErrorByType(api, organization.slug, projectId, errortype);
    refetchErrors();
  }

  const showAddMonitor = !isValidPlatform(platform) || !isValidGuide(guide);

  return (
    <SentryDocumentTitle title={t(`Crons`)} orgSlug={organization.slug}>
      <CronsListPageHeader organization={organization} />
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
            </Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <FeedbackWidgetButton />
              <Button
                icon={<IconList />}
                size="sm"
                onClick={() =>
                  openBulkEditMonitorsModal({
                    onClose: () => refetch(),
                  })
                }
                analyticsEventKey="crons.bulk_edit_modal_button_clicked"
                analyticsEventName="Crons: Bulk Edit Modal Button Clicked"
              >
                {t('Manage Monitors')}
              </Button>
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
              <OwnerFilter
                selectedOwners={decodeList(location.query.owner)}
                onChangeFilter={owner => {
                  navigate(
                    {
                      ...location,
                      query: {...location.query, owner, cursor: undefined},
                    },
                    {replace: true}
                  );
                }}
              />
              <PageFilterBar>
                <ProjectPageFilter resetParamsOnChange={['cursor']} />
                <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
                <DatePageFilter />
              </PageFilterBar>
              <SearchBar
                query={decodeScalar(qs.parse(location.search)?.query, '')}
                placeholder={t('Search by name or slug')}
                onSearch={handleSearch}
              />
            </Filters>
            {!!processingErrors?.length && (
              <MonitorProcessingErrors
                checkinErrors={processingErrors}
                onDismiss={handleDismissError}
              >
                {t(
                  'Errors were encountered while ingesting check-ins for the selected projects'
                )}
              </MonitorProcessingErrors>
            )}
            {isPending ? (
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
  display: flex;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};

  > :last-child {
    flex-grow: 1;
  }
`;
