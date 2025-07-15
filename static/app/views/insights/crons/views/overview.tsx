import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {openBulkEditMonitorsModal} from 'sentry/actionCreators/modal';
import {deleteProjectProcessingErrorByType} from 'sentry/actionCreators/monitors';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
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
} from 'sentry/views/insights/crons/components/cronsLandingPanel';
import {NewMonitorButton} from 'sentry/views/insights/crons/components/newMonitorButton';
import {OverviewTimeline} from 'sentry/views/insights/crons/components/overviewTimeline';
import {OwnerFilter} from 'sentry/views/insights/crons/components/ownerFilter';
import {MonitorProcessingErrors} from 'sentry/views/insights/crons/components/processingErrors/monitorProcessingErrors';
import {makeMonitorListErrorsQueryKey} from 'sentry/views/insights/crons/components/processingErrors/utils';
import {MODULE_DESCRIPTION, MODULE_DOC_LINK} from 'sentry/views/insights/crons/settings';
import type {
  CheckinProcessingError,
  Monitor,
  ProcessingErrorType,
} from 'sentry/views/insights/crons/types';
import {makeMonitorListQueryKey} from 'sentry/views/insights/crons/utils';

const CronsListPageHeader = HookOrDefault({
  hookName: 'component:crons-list-page-header',
});

function CronsOverview() {
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
    const currentQuery = {...location.query, cursor: undefined};
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

  const page = (
    <Fragment>
      <CronsListPageHeader organization={organization} />
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Cron Monitors')}
            <PageHeadingQuestionTooltip
              docsUrl={MODULE_DOC_LINK}
              title={MODULE_DESCRIPTION}
            />
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar>
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
              <DatePageFilter maxPickableDays={30} />
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
    </Fragment>
  );

  return (
    <NoProjectMessage organization={organization}>
      <SentryDocumentTitle title={t('Cron Monitors')} orgSlug={organization.slug}>
        <PageFiltersContainer>{page}</PageFiltersContainer>
      </SentryDocumentTitle>
    </NoProjectMessage>
  );
}

export default CronsOverview;

const Filters = styled('div')`
  display: flex;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};

  > :last-child {
    flex-grow: 1;
  }
`;
