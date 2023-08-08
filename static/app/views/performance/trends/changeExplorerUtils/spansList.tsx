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
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import SuspectSpansQuery from 'sentry/utils/performance/suspectSpans/suspectSpansQuery';
import {SuspectSpan, SuspectSpans} from 'sentry/utils/performance/suspectSpans/types';
import {EventsResultsDataRow, Sort} from 'sentry/utils/profiling/hooks/types';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
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
  relativeChange,
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
  avgTimeDifference: number;
  changeType: string;
  percentChange: number;
};

type AveragedSuspectFunction = EventsResultsDataRow<FunctionsField> & {
  avgSumExclusiveTime: number;
};

type ChangedSuspectFunction = AveragedSuspectFunction & {
  avgTimeDifference: number;
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
  functions?: ChangedSuspectFunction[];
  project?: Project;
  projectID?: string;
  spans?: ChangedSuspectSpan[];
};

export const SpanChangeType = {
  added: t('Added'),
  removed: t('Removed'),
  regressed: t('Regressed'),
  improved: t('Improved'),
};

const functionsFields = [
  'package',
  'function',
  'count()',
  'p75()',
  'sum()',
  'examples()',
] as const;

export type FunctionsField = (typeof functionsFields)[number];

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

  const transactionCountBefore = totalTransactionsBefore?.data
    ? (totalTransactionsBefore?.data[0]['count()'] as number)
    : 0;

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

  const transactionCountAfter = totalTransactionsAfter?.data
    ? (totalTransactionsAfter?.data[0]['count()'] as number)
    : 0;

  const functionsSort: Sort<FunctionsField> = {key: 'sum()', order: 'desc'};

  const query = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('transaction', [transaction.transaction]);
    return conditions.formatString();
  }, [transaction.transaction]);

  const beforeFunctionsQuery = useProfileFunctions<FunctionsField>({
    fields: functionsFields,
    referrer: 'api.performance.performance-change-explorer',
    sort: functionsSort,
    query,
    limit: 50,
    datetime: {
      end: breakpointTime,
      start: startTime,
      period: null,
      utc: null,
    },
  });

  const afterFunctionsQuery = useProfileFunctions<FunctionsField>({
    fields: functionsFields,
    referrer: 'api.performance.performance-change-explorer',
    sort: functionsSort,
    query,
    limit: 50,
    datetime: {
      end: endTime,
      start: breakpointTime,
      period: null,
      utc: null,
    },
  });

  // need these averaged fields because comparing total self times may be inaccurate depending on
  // where the breakpoint is
  const functionsAveragedAfter = addAvgSumOfFunctions(
    afterFunctionsQuery.data?.data,
    transactionCountAfter
  );
  const functionsAveragedBefore = addAvgSumOfFunctions(
    beforeFunctionsQuery.data?.data,
    transactionCountBefore
  );

  const addedFunctions = addFunctionChangeFields(
    findFunctionsNotIn(functionsAveragedAfter, functionsAveragedBefore),
    true
  );
  const removedFunctions = addFunctionChangeFields(
    findFunctionsNotIn(functionsAveragedBefore, functionsAveragedAfter),
    false
  );

  const remainingFunctionsBefore = findFunctionsIn(
    functionsAveragedBefore,
    functionsAveragedAfter
  );
  const remainingFunctionsAfter = findFunctionsIn(
    functionsAveragedAfter,
    functionsAveragedBefore
  );

  const remainingFunctionsWithChange = addPercentChangeInFunctions(
    remainingFunctionsBefore,
    remainingFunctionsAfter
  );

  const allFunctionsUpdated = remainingFunctionsWithChange
    ?.concat(addedFunctions ? addedFunctions : [])
    .concat(removedFunctions ? removedFunctions : []);

  // sorts all functions in descending order of avgTimeDifference (change in avg total self time)
  const functionList = allFunctionsUpdated?.sort(
    (a, b) => b.avgTimeDifference - a.avgTimeDifference
  );

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

              const addedSpans = addSpanChangeFields(
                findSpansNotIn(spansAveragedAfter, spansAveragedBefore),
                true
              );
              const removedSpans = addSpanChangeFields(
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

              const remainingSpansWithChange = addPercentChangeInSpans(
                remainingSpansBefore,
                remainingSpansAfter
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
                <NumberedList
                  spans={
                    trendChangeType === TrendChangeType.REGRESSION
                      ? spanList
                      : spanList?.reverse()
                  }
                  functions={
                    trendChangeType === TrendChangeType.REGRESSION
                      ? functionList
                      : functionList?.reverse()
                  }
                  projectID={projectID}
                  project={projects.find(project => project.id === projectID)}
                  location={location}
                  organization={organization}
                  transactionName={transaction.transaction}
                  limit={8}
                  isLoading={
                    transactionsLoadingBefore ||
                    transactionsLoadingAfter ||
                    spansLoadingBefore ||
                    spansLoadingAfter ||
                    beforeFunctionsQuery.isLoading ||
                    afterFunctionsQuery.isLoading
                  }
                  isError={
                    transactionsErrorBefore ||
                    transactionsErrorAfter ||
                    ((hasSpansErrorBefore || hasSpansErrorAfter) &&
                      (beforeFunctionsQuery.isError || afterFunctionsQuery.isError))
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

function findFunctionsNotIn(
  initialFunctions: AveragedSuspectFunction[] | undefined,
  comparingFunctions: AveragedSuspectFunction[] | undefined
) {
  return initialFunctions?.filter(initialValue => {
    const functionInComparingSet = comparingFunctions?.find(
      comparingValue =>
        comparingValue.function === initialValue.function &&
        comparingValue.package === initialValue.package
    );
    return functionInComparingSet === undefined;
  });
}

function findFunctionsIn(
  initialFunctions: AveragedSuspectFunction[] | undefined,
  comparingFunctions: AveragedSuspectFunction[] | undefined
) {
  return initialFunctions?.filter(initialValue => {
    const functionInComparingSet = comparingFunctions?.find(
      comparingValue =>
        comparingValue.function === initialValue.function &&
        comparingValue.package === initialValue.package
    );
    return functionInComparingSet !== undefined;
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

/**
 *
 * adds an average of the sum() time so it is more comparable when the breakpoint
 * is not close to the middle of the timeseries
 */
function addAvgSumOfFunctions(
  suspectFunctions: EventsResultsDataRow<FunctionsField>[] | undefined,
  transactionCount: number
) {
  return suspectFunctions?.map(susFunc => {
    return {
      ...susFunc,
      avgSumExclusiveTime: (susFunc['sum()'] as number)
        ? (susFunc['sum()'] as number) / transactionCount
        : 0,
    };
  });
}

function addPercentChangeInSpans(
  before: AveragedSuspectSpan[] | undefined,
  after: AveragedSuspectSpan[] | undefined
) {
  return after?.map(spanAfter => {
    const spanBefore = before?.find(
      beforeValue =>
        spanAfter.op === beforeValue.op && spanAfter.group === beforeValue.group
    );
    const percentageChange =
      relativeChange(
        spanBefore?.avgSumExclusiveTime || 0,
        spanAfter.avgSumExclusiveTime
      ) * 100;
    return {
      ...spanAfter,
      percentChange: percentageChange,
      avgTimeDifference:
        spanAfter.avgSumExclusiveTime - (spanBefore?.avgSumExclusiveTime || 0),
      changeType:
        percentageChange < 0 ? SpanChangeType.improved : SpanChangeType.regressed,
    };
  });
}

function addPercentChangeInFunctions(
  before: AveragedSuspectFunction[] | undefined,
  after: AveragedSuspectFunction[] | undefined
) {
  return after?.map(functionAfter => {
    const functionBefore = before?.find(
      beforeValue =>
        functionAfter.function === beforeValue.function &&
        functionAfter.package === beforeValue.package
    );
    const percentageChange =
      relativeChange(
        functionBefore?.avgSumExclusiveTime || 0,
        functionAfter.avgSumExclusiveTime
      ) * 100;
    return {
      ...functionAfter,
      percentChange: percentageChange,
      avgTimeDifference:
        functionAfter.avgSumExclusiveTime - (functionBefore?.avgSumExclusiveTime || 0),
      changeType:
        percentageChange < 0 ? SpanChangeType.improved : SpanChangeType.regressed,
    };
  });
}

function addSpanChangeFields(
  spans: AveragedSuspectSpan[] | undefined,
  added: boolean
): ChangedSuspectSpan[] | undefined {
  // percent change is hardcoded to pass the 1% change threshold,
  // avoid infinite values and reflect correct change type
  return spans?.map(span => {
    if (added) {
      return {
        ...span,
        percentChange: 100,
        avgTimeDifference: span.avgSumExclusiveTime,
        changeType: SpanChangeType.added,
      };
    }
    return {
      ...span,
      percentChange: -100,
      avgTimeDifference: 0 - span.avgSumExclusiveTime,
      changeType: SpanChangeType.removed,
    };
  });
}

function addFunctionChangeFields(
  functions: AveragedSuspectFunction[] | undefined,
  added: boolean
): ChangedSuspectFunction[] | undefined {
  // percent change is hardcoded to pass the 1% change threshold,
  // avoid infinite values and reflect correct change type
  return functions?.map(func => {
    if (added) {
      return {
        ...func,
        percentChange: 100,
        avgTimeDifference: func.avgSumExclusiveTime,
        changeType: SpanChangeType.added,
      };
    }
    return {
      ...func,
      percentChange: -100,
      avgTimeDifference: 0 - func.avgSumExclusiveTime,
      changeType: SpanChangeType.removed,
    };
  });
}

export function NumberedList(props: NumberedListProps) {
  const {
    spans,
    projectID,
    project,
    location,
    transactionName,
    organization,
    limit,
    isLoading,
    isError,
    functions,
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

  if ((spans?.length === 0 || !spans) && (functions?.length === 0 || !functions)) {
    return (
      <EmptyStateWarning>
        <p data-test-id="spans-no-results">{t('No results found for your query')}</p>
      </EmptyStateWarning>
    );
  }

  let spansLimit = limit / 2;
  let functionsLimit = limit / 2;

  if (spans && (!functions || functions.length === 0)) {
    spansLimit = limit;
    functionsLimit = 0;
  }
  if (functions && (!spans || spans.length === 0)) {
    functionsLimit = limit;
    spansLimit = 0;
  }

  // percent change of a span must be more than 1%
  const formattedSpans = spans
    ?.filter(span => (spans.length > 10 ? Math.abs(span.percentChange) >= 1 : true))
    .slice(0, spansLimit)
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
          </ListItemWrapper>
        </li>
      );
    });

  // percent change of a function must be more than 1%
  const formattedFunctions = functions
    ?.filter(func => (functions.length > 10 ? Math.abs(func.percentChange) >= 1 : true))
    .slice(0, functionsLimit)
    .map((func, index) => {
      const profiles = func['examples()'] as string[];

      const functionSummaryView = generateProfileFlamechartRouteWithQuery({
        orgSlug: organization.slug,
        projectSlug: project?.slug || '',
        profileId: profiles[0],
        query: {
          frameName: func.function as string,
          framePackage: func.package as string,
        },
      });

      const handleClickAnalytics = () => {
        trackAnalytics(
          'performance_views.performance_change_explorer.function_link_clicked',
          {
            organization,
            transaction: transactionName,
            package: func.package as string,
            function: func.function as string,
            profile_id: profiles[0],
          }
        );
      };

      return (
        <li key={`list-item-${index}`}>
          <ListItemWrapper data-test-id="list-item">
            <p style={{marginLeft: space(2)}}>
              {tct('[changeType] suspect function', {changeType: func.changeType})}
            </p>
            <ListLink to={functionSummaryView} onClick={handleClickAnalytics}>
              {func.function}
            </ListLink>
          </ListItemWrapper>
        </li>
      );
    });

  if (formattedSpans?.length === 0 && formattedFunctions?.length === 0) {
    return (
      <EmptyStateWarning>
        <p data-test-id="spans-no-changes">
          {t('No sizable changes in suspect spans and functions')}
        </p>
      </EmptyStateWarning>
    );
  }

  return (
    <div style={{marginTop: space(4)}}>
      <ol>
        {formattedSpans}
        {formattedFunctions}
      </ol>
    </div>
  );
}

const ListLink = styled(Link)`
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
