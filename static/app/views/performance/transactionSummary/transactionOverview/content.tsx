import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import omit from 'lodash/omit';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SuspectFunctionsTable} from 'sentry/components/profiling/suspectFunctions/suspectFunctionsTable';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {EventView} from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {projectSupportsReplay} from 'sentry/utils/replays/projectSupportsReplay';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useNavigate} from 'sentry/utils/useNavigate';
import {withProjects} from 'sentry/utils/withProjects';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {SpanFields} from 'sentry/views/insights/types';
import {SegmentSpansTable} from 'sentry/views/performance/eap/segmentSpansTable';
import {
  filterToSearchConditions,
  SpanOperationBreakdownFilter,
} from 'sentry/views/performance/transactionSummary/filter';
import {SpanCategoryFilter} from 'sentry/views/performance/transactionSummary/spanCategoryFilter';
import {EAPChartsWidget} from 'sentry/views/performance/transactionSummary/transactionOverview/eapChartsWidget';
import {EAPSidebarCharts} from 'sentry/views/performance/transactionSummary/transactionOverview/eapSidebarCharts';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';
import {
  isSummaryViewFrontend,
  isSummaryViewFrontendPageLoad,
} from 'sentry/views/performance/utils';

import {PerformanceAtScaleContextProvider} from './performanceAtScaleContext';
import {RelatedIssues} from './relatedIssues';
import {StatusBreakdown} from './statusBreakdown';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projectId: string;
  projects: Project[];
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  totalValues: Record<string, number> | null;
  transactionName: string;
};

export const SEGMENT_SPANS_CURSOR_NAME = 'segmentSpansCursor';

function EAPSummaryContentInner({
  eventView,
  location,
  totalValues,
  spanOperationBreakdownFilter,
  organization,
  projects,
  projectId,
  transactionName,
}: Props) {
  const navigate = useNavigate();
  const spanCategory = decodeScalar(location.query?.[SpanFields.SPAN_CATEGORY]);

  const handleSearch = useCallback(
    (query: string) => {
      const queryParams = normalizeDateTimeParams({
        ...location.query,
        query,
      });

      // do not propagate pagination when making a new search
      const searchQueryParams = omit(queryParams, 'cursor');

      navigate({
        pathname: location.pathname,
        query: searchQueryParams,
      });
    },
    [location, navigate]
  );

  function handleTransactionsListSortChange(value: string) {
    const target = {
      pathname: location.pathname,
      query: {
        ...location.query,
        showTransactions: value,
        [SEGMENT_SPANS_CURSOR_NAME]: undefined,
      },
    };

    navigate(target);
  }

  const query = useMemo(() => {
    return decodeScalar(location.query.query, '');
  }, [location]);

  // NOTE: This is not a robust check for whether or not a transaction is a front end
  // transaction, however it will suffice for now.
  const hasWebVitals = isSummaryViewFrontendPageLoad(eventView, projects);

  const isFrontendView = isSummaryViewFrontend(eventView, projects);

  const transactionsListTitles = [
    t('event id'),
    t('user'),
    t('total duration'),
    t('trace id'),
    t('timestamp'),
  ];

  const project = projects.find(p => p.id === projectId);

  let transactionsListEventView = eventView.clone();
  const fields = [...transactionsListEventView.fields];

  if (
    organization.features.includes('session-replay') &&
    project &&
    projectSupportsReplay(project)
  ) {
    transactionsListTitles.push(t('replay'));
    fields.push({field: 'replayId'});
  }

  if (
    // only show for projects that already sent a profile
    // once we have a more compact design we will show this for
    // projects that support profiling as well
    project?.hasProfiles &&
    (organization.features.includes('profiling') ||
      organization.features.includes('continuous-profiling'))
  ) {
    transactionsListTitles.push(t('profile'));

    if (organization.features.includes('profiling')) {
      fields.push({field: 'profile.id'});
    }

    if (organization.features.includes('continuous-profiling')) {
      fields.push(
        {field: 'profiler.id'},
        {field: 'thread.id'},
        {field: 'precise.start_ts'},
        {field: 'precise.finish_ts'}
      );
    }
  }

  // update search conditions

  const spanOperationBreakdownConditions = filterToSearchConditions(
    spanOperationBreakdownFilter,
    location
  );

  if (spanOperationBreakdownConditions) {
    eventView = eventView.clone();
    eventView.query = `${eventView.query} ${spanOperationBreakdownConditions}`.trim();
    transactionsListEventView = eventView.clone();
  }

  if (spanCategory) {
    eventView = eventView.clone();
    eventView.query =
      `${eventView.query} ${SpanFields.SPAN_CATEGORY}:${spanCategory}`.trim();
    transactionsListEventView = eventView.clone();
  }

  transactionsListEventView.fields = fields;

  const projectIds = useMemo(() => eventView.project.slice(), [eventView.project]);

  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  const {spanSearchQueryBuilderProps} = useSpanSearchQueryBuilderProps({
    projects: projectIds,
    initialQuery: query,
    onSearch: handleSearch,
    searchSource: 'transaction_summary',
  });

  return (
    <Fragment>
      <Layout.Main>
        <FilterActions>
          <SpanCategoryFilter segmentSpanName={transactionName} />
          <PageFilterBar condensed>
            <EnvironmentPageFilter />
            <DatePageFilter {...datePageFilterProps} />
          </PageFilterBar>
          <StyledSearchBarWrapper>
            <TraceItemSearchQueryBuilder
              {...spanSearchQueryBuilderProps}
              disallowFreeText
            />
          </StyledSearchBarWrapper>
        </FilterActions>
        <EAPChartsWidgetContainer>
          <EAPChartsWidget transactionName={transactionName} query={query} />
        </EAPChartsWidgetContainer>

        <PerformanceAtScaleContextProvider>
          <SegmentSpansTable
            eventView={transactionsListEventView}
            handleDropdownChange={handleTransactionsListSortChange}
            totalValues={totalValues}
            transactionName={transactionName}
            query={query}
            showViewSampledEventsButton
          />
        </PerformanceAtScaleContextProvider>
        <SuspectFunctionsTable
          eventView={eventView}
          analyticsPageSource="performance_transaction"
          project={project}
        />
        <RelatedIssues
          organization={organization}
          location={location}
          transaction={transactionName}
          start={eventView.start}
          end={eventView.end}
          statsPeriod={eventView.statsPeriod}
        />
      </Layout.Main>
      <Layout.Side>
        {!isFrontendView && (
          <StatusBreakdown
            eventView={eventView}
            organization={organization}
            location={location}
          />
        )}
        <SidebarSpacer />
        <EAPSidebarCharts transactionName={transactionName} hasWebVitals={hasWebVitals} />
        <SidebarSpacer />
      </Layout.Side>
    </Fragment>
  );
}

const FilterActions = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xl};
  margin-bottom: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, min-content);
  }

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    grid-template-columns: auto auto 1fr;
  }
`;

const StyledSearchBarWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    order: 1;
    grid-column: 1/4;
  }

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    order: initial;
    grid-column: auto;
  }
`;

const EAPChartsWidgetContainer = styled('div')`
  height: 300px;
  margin-bottom: ${p => p.theme.space.xl};
`;

export const EAPSummaryContent = withProjects(EAPSummaryContentInner);
