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
import SuspectSpansQuery from 'sentry/utils/performance/suspectSpans/suspectSpansQuery';
import {SuspectSpan, SuspectSpans} from 'sentry/utils/performance/suspectSpans/types';
import theme from 'sentry/utils/theme';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useProjects from 'sentry/utils/useProjects';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {
  SpanSort,
  SpanSortOption,
  SpanSortOthers,
  SpanSortPercentiles,
} from 'sentry/views/performance/transactionSummary/transactionSpans/types';
import {
  getSuspectSpanSortFromLocation,
  SPAN_SORT_TO_FIELDS,
} from 'sentry/views/performance/transactionSummary/transactionSpans/utils';
import {relativeChange} from 'sentry/views/performance/trends/changeExplorerUtils/metricsTable';
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
  trendFunction: string;
  trendView: TrendView;
};

type AveragedSuspectSpan = SuspectSpan & {
  avgExclusiveTime: number;
};

export type ChangedSuspectSpan = AveragedSuspectSpan & {
  avgTimeDifference: number;
  changeType: string;
  percentChange: number;
};

type NumberedSpansListProps = {
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

const SpanFunctionToField = {
  p50: 'p50ExclusiveTime',
  p75: 'p75ExclusiveTime',
  p95: 'p95ExclusiveTime',
  p99: 'p99ExclusiveTime',
  avg: 'p75ExclusiveTime',
};

export function SpansList(props: SpansListProps) {
  const {
    trendView,
    location,
    organization,
    breakpoint,
    transaction,
    trendChangeType,
    trendFunction,
  } = props;

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
    SpanSortOthers.SUM_EXCLUSIVE_TIME,
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
    SpanSortOthers.SUM_EXCLUSIVE_TIME,
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
              const field = SpanFunctionToField[trendFunction];

              const spansAveragedAfter = addAvgExclusiveTime(suspectSpansAfter, field);
              const spansAveragedBefore = addAvgExclusiveTime(suspectSpansBefore, field);

              const addedSpans = addSpanChangeFields(
                findSpansNotIn(spansAveragedAfter, spansAveragedBefore),
                true,
                field
              );
              const removedSpans = addSpanChangeFields(
                findSpansNotIn(spansAveragedBefore, spansAveragedAfter),
                false,
                field
              );

              const remainingSpansBefore = findSpansIn(
                spansAveragedBefore,
                spansAveragedAfter
              );
              const remainingSpansAfter = findSpansIn(
                spansAveragedAfter,
                spansAveragedBefore
              );

              const remainingSpansWithChange = addPercentChangeInSpans(
                remainingSpansBefore,
                remainingSpansAfter,
                field
              );

              const allSpansUpdated = remainingSpansWithChange
                ?.concat(addedSpans ? addedSpans : [])
                .concat(removedSpans ? removedSpans : []);

              // sorts all spans in descending order of avgTimeDifference (change in avg total self time)
              const spanList = allSpansUpdated?.sort(
                (a, b) => b.avgTimeDifference - a.avgTimeDifference
              );
              // reverse the span list when trendChangeType is improvement so most negative (improved) change is first
              return (
                <div style={{marginTop: space(4)}}>
                  <h6>{t('Relevant Suspect Spans')}</h6>
                  <NumberedSpansList
                    spans={
                      trendChangeType === TrendChangeType.REGRESSION
                        ? spanList
                        : spanList?.reverse()
                    }
                    projectID={projectID}
                    location={location}
                    organization={organization}
                    transactionName={transaction.transaction}
                    limit={4}
                    isLoading={spansLoadingBefore || spansLoadingAfter}
                    isError={hasSpansErrorBefore || hasSpansErrorAfter}
                  />
                </div>
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
  sort: SpanSort,
  projectID?: string
) {
  return {
    ...location,
    start,
    end,
    statsPeriod: undefined,
    spanSort: sort,
    project: projectID,
    query: {
      query: 'transaction:' + transaction.transaction,
      statsPeriod: undefined,
      start,
      end,
      project: projectID,
      spanSort: sort,
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
    const spanInComparingSet = comparingSpans?.find(
      comparingValue =>
        comparingValue.op === initialValue.op &&
        comparingValue.group === initialValue.group
    );
    return spanInComparingSet === undefined;
  });
}

function findSpansIn(
  initialSpans: AveragedSuspectSpan[] | undefined,
  comparingSpans: AveragedSuspectSpan[] | undefined
) {
  return initialSpans?.filter(initialValue => {
    const spanInComparingSet = comparingSpans?.find(
      comparingValue =>
        comparingValue.op === initialValue.op &&
        comparingValue.group === initialValue.group
    );
    return spanInComparingSet !== undefined;
  });
}

/**
 *
 * adds an average of the appropriate percentileExclusive time so we can compare avg time of span
 * in a singular transaction
 */
function addAvgExclusiveTime(suspectSpans: SuspectSpans | null, field: string) {
  return suspectSpans?.map(span => {
    return {
      ...span,
      avgExclusiveTime:
        span[field] && span.avgOccurrences ? span[field] * span.avgOccurrences : 0,
    };
  });
}

function addPercentChangeInSpans(
  before: AveragedSuspectSpan[] | undefined,
  after: AveragedSuspectSpan[] | undefined,
  field: string
) {
  return after?.map(spanAfter => {
    const spanBefore = before?.find(
      beforeValue =>
        spanAfter.op === beforeValue.op && spanAfter.group === beforeValue.group
    );
    const percentageChange =
      relativeChange(spanBefore?.[field] || 0, spanAfter[field]) * 100;
    return {
      ...spanAfter,
      percentChange: percentageChange,
      avgTimeDifference: spanAfter[field]! - (spanBefore?.[field] || 0),
      changeType:
        percentageChange < 0 ? SpanChangeType.improved : SpanChangeType.regressed,
    };
  });
}

function addSpanChangeFields(
  spans: AveragedSuspectSpan[] | undefined,
  added: boolean,
  field: string
): ChangedSuspectSpan[] | undefined {
  // percent change is hardcoded to pass the 1% change threshold,
  // avoid infinite values and reflect correct change type
  return spans?.map(span => {
    if (added) {
      return {
        ...span,
        percentChange: 100,
        avgTimeDifference: span[field],
        changeType: SpanChangeType.added,
      };
    }
    return {
      ...span,
      percentChange: -100,
      avgTimeDifference: 0 - span[field],
      changeType: SpanChangeType.removed,
    };
  });
}

export function TimeDifference({difference}: {difference: number}) {
  const positive = difference >= 0;
  const roundedDifference = difference.toPrecision(3);
  return (
    <p
      style={{
        alignSelf: 'end',
        color: positive ? theme.red300 : theme.green300,
        marginLeft: space(2),
      }}
      data-test-id="list-delta"
    >
      {positive ? `+${roundedDifference} ms` : `${roundedDifference} ms`}
    </p>
  );
}

export function NumberedSpansList(props: NumberedSpansListProps) {
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
        <IconWarning data-test-id="error-indicator-spans" color="gray200" size="xxl" />
        <p>{t('There was an issue finding suspect spans for this transaction')}</p>
      </ErrorWrapper>
    );
  }

  if (spans?.length === 0 || !spans) {
    return (
      <EmptyStateWarning>
        <p data-test-id="spans-no-results">{t('No results found for suspect spans')}</p>
      </EmptyStateWarning>
    );
  }

  // percent change of a span must be more than 1%
  const formattedSpans = spans
    ?.filter(span =>
      spans.length > 10
        ? Math.abs(span.percentChange) >= 1 && span.frequency && span.frequency > 50
        : true
    )
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
            <ListLink to={spanDetailsPage} onClick={handleClickAnalytics}>
              {span.description ? `${span.op} - ${span.description}` : span.op}
            </ListLink>
            <TimeDifference difference={span.avgTimeDifference} />
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

  return <ol>{formattedSpans}</ol>;
}

export const ListLink = styled(Link)`
  margin-left: ${space(1)};
  ${p => p.theme.overflowEllipsis}
`;
export const ListItemWrapper = styled('div')`
  display: flex;
  white-space: nowrap;
`;

export const ErrorWrapper = styled('div')`
  display: flex;
  margin-top: ${space(4)};
  flex-direction: column;
  align-items: center;
  gap: ${space(3)};
`;
