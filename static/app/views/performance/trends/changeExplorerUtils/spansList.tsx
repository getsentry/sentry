import {useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import SuspectSpansQuery from 'sentry/utils/performance/suspectSpans/suspectSpansQuery';
import {SuspectSpan, SuspectSpans} from 'sentry/utils/performance/suspectSpans/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useProjects from 'sentry/utils/useProjects';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {
  SpanSortOption,
  SpanSortOthers,
  SpanSortPercentiles,
} from 'sentry/views/performance/transactionSummary/transactionSpans/types';
import {
  getSuspectSpanSortFromLocation,
  SPAN_SORT_TO_FIELDS,
} from 'sentry/views/performance/transactionSummary/transactionSpans/utils';
import {
  getQueryParams,
  percentChange,
} from 'sentry/views/performance/trends/changeExplorerUtils/metricsTable';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendView,
} from 'sentry/views/performance/trends/types';
import {getTrendProjectId} from 'sentry/views/performance/trends/utils';

type SpansListProps = {
  breakpoint: number;
  location: Location;
  organization: Organization;
  transaction: NormalizedTrendsTransaction;
  trendChangeType: TrendChangeType;
  trendView: TrendView;
};

type AveragedSuspectSpan = SuspectSpan & {
  avgSumExclusiveTime: number;
};

export type ChangedSuspectSpan = AveragedSuspectSpan & {
  avgChange: number;
  changeType: string;
  percentChange: number;
};

type NumberedListProps = {
  isError: boolean;
  isLoading: boolean;
  limit: number;
  location: Location;
  organization: Organization;
  transactionName: string;
  projectID?: string;
  spans?: ChangedSuspectSpan[];
};

export const SpanChangeType = {
  added: t('Added'),
  removed: t('Removed'),
  regressed: t('Regressed'),
  improved: t('Improved'),
};

export function SpansList(props: SpansListProps) {
  const {trendView, location, organization, breakpoint, transaction, trendChangeType} =
    props;

  const hours = trendView.statsPeriod ? parsePeriodToHours(trendView.statsPeriod) : 0;
  const startTime = useMemo(
    () =>
      trendView.start ? trendView.start : moment().subtract(hours, 'h').toISOString(),
    [hours, trendView.start]
  );
  const breakpointTime = breakpoint ? new Date(breakpoint * 1000).toISOString() : '';
  const endTime = useMemo(
    () => (trendView.end ? trendView.end : moment().toISOString()),
    [trendView.end]
  );

  const {projects} = useProjects();
  const projectID = getTrendProjectId(transaction, projects);

  const beforeLocation = updateLocation(
    location,
    startTime,
    breakpointTime,
    transaction,
    projectID
  );

  const beforeSort = getSuspectSpanSortFromLocation(beforeLocation, 'spanSort');

  const beforeEventView = updateEventView(
    trendView,
    startTime,
    breakpointTime,
    transaction,
    beforeSort,
    projectID
  );

  const beforeFields = SPAN_SORT_TO_FIELDS[beforeSort.field];
  beforeEventView.fields = beforeFields ? beforeFields.map(field => ({field})) : [];

  const afterLocation = updateLocation(
    location,
    startTime,
    breakpointTime,
    transaction,
    projectID
  );

  const afterSort = getSuspectSpanSortFromLocation(afterLocation, 'spanSort');

  const afterEventView = updateEventView(
    trendView,
    breakpointTime,
    endTime,
    transaction,
    afterSort,
    projectID
  );

  const afterFields = SPAN_SORT_TO_FIELDS[afterSort.field];
  afterEventView.fields = afterFields ? afterFields.map(field => ({field})) : [];

  const {
    data: totalTransactionsBefore,
    isLoading: transactionsLoadingBefore,
    isError: transactionsErrorBefore,
  } = useDiscoverQuery(
    getQueryParams(
      startTime,
      breakpointTime,
      ['count'],
      'transaction',
      DiscoverDatasets.METRICS,
      organization,
      trendView,
      transaction.transaction,
      location
    )
  );

  const transactionCountBefore = totalTransactionsBefore?.data[0]['count()'] as number;

  const {
    data: totalTransactionsAfter,
    isLoading: transactionsLoadingAfter,
    isError: transactionsErrorAfter,
  } = useDiscoverQuery(
    getQueryParams(
      breakpointTime,
      endTime,
      ['count'],
      'transaction',
      DiscoverDatasets.METRICS,
      organization,
      trendView,
      transaction.transaction,
      location
    )
  );

  const transactionCountAfter = totalTransactionsAfter?.data[0]['count()'] as number;

  return (
    <SuspectSpansQuery
      location={beforeLocation}
      orgSlug={organization.slug}
      eventView={beforeEventView}
      limit={50}
      perSuspect={0}
    >
      {({
        suspectSpans: suspectSpansBefore,
        isLoading: spansLoadingBefore,
        error: spansErrorBefore,
      }) => {
        const hasSpansErrorBefore = spansErrorBefore !== null;
        return (
          <SuspectSpansQuery
            location={afterLocation}
            orgSlug={organization.slug}
            eventView={afterEventView}
            limit={50}
            perSuspect={0}
          >
            {({
              suspectSpans: suspectSpansAfter,
              isLoading: spansLoadingAfter,
              error: spansErrorAfter,
            }) => {
              const hasSpansErrorAfter = spansErrorAfter !== null;

              // need these averaged fields because comparing total self times may be inaccurate depending on
              // where the breakpoint is
              const spansAveragedAfter = addAvgSumExclusiveTime(
                suspectSpansAfter,
                transactionCountAfter
              );
              const spansAveragedBefore = addAvgSumExclusiveTime(
                suspectSpansBefore,
                transactionCountBefore
              );

              const addedSpans = addChangeFields(
                findSpansNotIn(spansAveragedAfter, spansAveragedBefore),
                true
              );
              const removedSpans = addChangeFields(
                findSpansNotIn(spansAveragedBefore, spansAveragedAfter),
                false
              );

              const remainingSpansBefore = findSpansIn(
                spansAveragedBefore,
                spansAveragedAfter
              );
              const remainingSpansAfter = findSpansIn(
                spansAveragedAfter,
                spansAveragedBefore
              );

              const remainingSpansWithChange = addPercentChange(
                remainingSpansBefore,
                remainingSpansAfter
              );

              const allSpansUpdated = remainingSpansWithChange
                ?.concat(addedSpans ? addedSpans : [])
                .concat(removedSpans ? removedSpans : []);

              // sorts all spans in descending order of avgChange (change in avg total self time)
              const spanList = allSpansUpdated?.sort((a, b) => b.avgChange - a.avgChange);
              // reverse the span list when trendChangeType is improvement so most negative (improved) change is first
              return (
                <NumberedList
                  spans={
                    trendChangeType === TrendChangeType.REGRESSION
                      ? spanList
                      : spanList?.reverse()
                  }
                  projectID={projectID}
                  location={location}
                  organization={organization}
                  transactionName={transaction.transaction}
                  limit={6}
                  isLoading={
                    transactionsLoadingBefore ||
                    transactionsLoadingAfter ||
                    spansLoadingBefore ||
                    spansLoadingAfter
                  }
                  isError={
                    hasSpansErrorBefore ||
                    hasSpansErrorAfter ||
                    transactionsErrorBefore ||
                    transactionsErrorAfter
                  }
                />
              );
            }}
          </SuspectSpansQuery>
        );
      }}
    </SuspectSpansQuery>
  );
}

function updateLocation(
  location: Location,
  start: string,
  end: string,
  transaction: NormalizedTrendsTransaction,
  projectID?: string
) {
  return {
    ...location,
    start,
    end,
    statsPeriod: undefined,
    sort: SpanSortOthers.SUM_EXCLUSIVE_TIME,
    project: projectID,
    query: {
      query: 'transaction:' + transaction.transaction,
      statsPeriod: undefined,
      start,
      end,
      project: projectID,
    },
  };
}

function updateEventView(
  trendView: TrendView,
  start: string,
  end: string,
  transaction: NormalizedTrendsTransaction,
  sort: SpanSortOption,
  projectID?: string
) {
  const newEventView = trendView.clone();
  newEventView.start = start;
  newEventView.end = end;
  newEventView.statsPeriod = undefined;
  newEventView.query = `event.type:transaction transaction:${transaction.transaction}`;
  newEventView.project = projectID ? [parseInt(projectID, 10)] : [];
  newEventView.additionalConditions = new MutableSearch('');
  return newEventView
    .withColumns(
      [...Object.values(SpanSortOthers), ...Object.values(SpanSortPercentiles)].map(
        field => ({kind: 'field', field})
      )
    )
    .withSorts([{kind: 'desc', field: sort.field}]);
}

function findSpansNotIn(
  initialSpans: AveragedSuspectSpan[] | undefined,
  comparingSpans: AveragedSuspectSpan[] | undefined
) {
  return initialSpans?.filter(initialValue => {
    const spanInComparingSet = comparingSpans?.filter(
      comparingValue =>
        comparingValue.op === initialValue.op &&
        comparingValue.group === initialValue.group
    );
    return spanInComparingSet?.length === 0;
  });
}

function findSpansIn(
  initialSpans: AveragedSuspectSpan[] | undefined,
  comparingSpans: AveragedSuspectSpan[] | undefined
) {
  return initialSpans?.filter(initialValue => {
    const spanInComparingSet = comparingSpans?.filter(
      comparingValue =>
        comparingValue.op === initialValue.op &&
        comparingValue.group === initialValue.group
    );
    return spanInComparingSet?.length !== 0;
  });
}

/**
 *
 * adds an average of the sumExclusive time so it is more comparable when the breakpoint
 * is not close to the middle of the timeseries
 */
function addAvgSumExclusiveTime(
  suspectSpans: SuspectSpans | null,
  transactionCount: number
) {
  return suspectSpans?.map(span => {
    return {
      ...span,
      avgSumExclusiveTime: span.sumExclusiveTime
        ? span.sumExclusiveTime / transactionCount
        : 0,
    };
  });
}

function addPercentChange(
  before: AveragedSuspectSpan[] | undefined,
  after: AveragedSuspectSpan[] | undefined
) {
  return after?.map(spanAfter => {
    const spanBefore = before?.find(
      beforeValue =>
        spanAfter.op === beforeValue.op && spanAfter.group === beforeValue.group
    );
    const percentageChange = percentChange(
      spanBefore?.avgSumExclusiveTime || 0,
      spanAfter.avgSumExclusiveTime
    );
    return {
      ...spanAfter,
      percentChange: percentageChange,
      avgChange: spanAfter.avgSumExclusiveTime - (spanBefore?.avgSumExclusiveTime || 0),
      changeType:
        percentageChange < 0 ? SpanChangeType.improved : SpanChangeType.regressed,
    };
  });
}

function addChangeFields(
  spans: AveragedSuspectSpan[] | undefined,
  added: boolean
): ChangedSuspectSpan[] | undefined {
  return spans?.map(span => {
    if (added) {
      return {
        ...span,
        percentChange: 100,
        avgChange: span.avgSumExclusiveTime,
        changeType: SpanChangeType.added,
      };
    }
    return {
      ...span,
      percentChange: -100,
      avgChange: 0 - span.avgSumExclusiveTime,
      changeType: SpanChangeType.removed,
    };
  });
}

export function NumberedList(props: NumberedListProps) {
  const {
    spans,
    projectID,
    location,
    transactionName,
    organization,
    limit,
    isLoading,
    isError,
  } = props;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <ErrorWrapper>
        <IconWarning data-test-id="error-indicator" color="gray200" size="xxl" />
        <p>{t('There was an issue finding suspect spans for this transaction')}</p>
      </ErrorWrapper>
    );
  }

  if (spans?.length === 0) {
    return (
      <EmptyStateWarning>
        <p data-test-id="spans-no-results">{t('No results found for your query')}</p>
      </EmptyStateWarning>
    );
  }

  const formattedSpans = spans
    ?.filter(span => (spans.length > 10 ? Math.abs(span.percentChange) >= 1 : true))
    .slice(0, limit)
    .map((span, index) => {
      const spanDetailsPage = spanDetailsRouteWithQuery({
        orgSlug: organization.slug,
        transaction: transactionName,
        query: location.query,
        spanSlug: {op: span.op, group: span.group},
        projectID,
      });

      const handleClickAnalytics = () => {
        trackAnalytics(
          'performance_views.performance_change_explorer.span_link_clicked',
          {
            organization,
            transaction: transactionName,
            op: span.op,
            group: span.group,
          }
        );
      };

      return (
        <li key={`list-item-${index}`}>
          <ListItemWrapper data-test-id="list-item">
            <p style={{marginLeft: space(2)}}>
              {tct('[changeType] suspect span', {changeType: span.changeType})}
            </p>
            <SpanLink to={spanDetailsPage} onClick={handleClickAnalytics}>
              {span.description ? span.description : t('(unnamed span)')}
            </SpanLink>
          </ListItemWrapper>
        </li>
      );
    });

  if (formattedSpans?.length === 0) {
    return (
      <EmptyStateWarning>
        <p data-test-id="spans-no-changes">{t('No sizable changes in suspect spans')}</p>
      </EmptyStateWarning>
    );
  }

  return (
    <div style={{marginTop: space(4)}}>
      <ol>{formattedSpans}</ol>
    </div>
  );
}

const SpanLink = styled(Link)`
  margin-left: ${space(1)};
  ${p => p.theme.overflowEllipsis}
`;
const ListItemWrapper = styled('div')`
  display: flex;
  white-space: nowrap;
`;

const ErrorWrapper = styled('div')`
  display: flex;
  margin-top: ${space(4)};
  flex-direction: column;
  align-items: center;
  gap: ${space(3)};
`;
