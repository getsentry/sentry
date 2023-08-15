import {useMemo} from 'react';
import {Location} from 'history';
import moment from 'moment';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EventsResultsDataRow, Sort} from 'sentry/utils/profiling/hooks/types';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useProjects from 'sentry/utils/useProjects';
import {
  getQueryParams,
  relativeChange,
} from 'sentry/views/performance/trends/changeExplorerUtils/metricsTable';
import {
  ErrorWrapper,
  ListItemWrapper,
  ListLink,
  TimeDifference,
} from 'sentry/views/performance/trends/changeExplorerUtils/spansList';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendView,
} from 'sentry/views/performance/trends/types';
import {getTrendProjectId} from 'sentry/views/performance/trends/utils';

type FunctionsListProps = {
  breakpoint: number;
  location: Location;
  organization: Organization;
  transaction: NormalizedTrendsTransaction;
  trendChangeType: TrendChangeType;
  trendView: TrendView;
};

type AveragedSuspectFunction = EventsResultsDataRow<FunctionsField> & {
  avgSumExclusiveTime: number;
};

type ChangedSuspectFunction = AveragedSuspectFunction & {
  avgTimeDifference: number;
  changeType: string;
  percentChange: number;
};

type NumberedFunctionsListProps = {
  isError: boolean;
  isLoading: boolean;
  limit: number;
  organization: Organization;
  transactionName: string;
  functions?: ChangedSuspectFunction[];
  project?: Project;
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

export const FunctionChangeType = {
  added: t('Added'),
  removed: t('Removed'),
  regressed: t('Regressed'),
  improved: t('Improved'),
};

export function FunctionsList(props: FunctionsListProps) {
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

  const functionsSort: Sort<FunctionsField> = {key: 'sum()', order: 'desc'};

  const query = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('transaction', [transaction.transaction]);
    return conditions.formatString();
  }, [transaction.transaction]);

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
    <div>
      <h6>{t('Relevant Suspect Functions')}</h6>
      <NumberedFunctionsList
        functions={
          trendChangeType === TrendChangeType.REGRESSION
            ? functionList
            : functionList?.reverse()
        }
        project={projects.find(project => project.id === projectID)}
        organization={organization}
        transactionName={transaction.transaction}
        limit={4}
        isLoading={
          transactionsLoadingBefore ||
          transactionsLoadingAfter ||
          beforeFunctionsQuery.isLoading ||
          afterFunctionsQuery.isLoading
        }
        isError={
          transactionsErrorBefore ||
          transactionsErrorAfter ||
          beforeFunctionsQuery.isError ||
          afterFunctionsQuery.isError
        }
      />
    </div>
  );
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
        changeType: FunctionChangeType.added,
      };
    }
    return {
      ...func,
      percentChange: -100,
      avgTimeDifference: 0 - func.avgSumExclusiveTime,
      changeType: FunctionChangeType.removed,
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
        percentageChange < 0 ? FunctionChangeType.improved : FunctionChangeType.regressed,
    };
  });
}

export function NumberedFunctionsList(props: NumberedFunctionsListProps) {
  const {project, transactionName, organization, limit, isLoading, isError, functions} =
    props;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <ErrorWrapper>
        <IconWarning
          data-test-id="error-indicator-functions"
          color="gray200"
          size="xxl"
        />
        <p>{t('There was an issue finding suspect functions for this transaction')}</p>
      </ErrorWrapper>
    );
  }

  if (functions?.length === 0 || !functions) {
    return (
      <EmptyStateWarning>
        <p data-test-id="functions-no-results">
          {t('No results found for suspect functions')}
        </p>
      </EmptyStateWarning>
    );
  }

  // percent change of a function must be more than 1%
  const formattedFunctions = functions
    ?.filter(func => (functions.length > 10 ? Math.abs(func.percentChange) >= 1 : true))
    .slice(0, limit)
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
            <TimeDifference difference={func.avgTimeDifference / 1000000} />
          </ListItemWrapper>
        </li>
      );
    });

  if (formattedFunctions?.length === 0) {
    return (
      <EmptyStateWarning>
        <p data-test-id="functions-no-changes">
          {t('No sizable changes in suspect functions')}
        </p>
      </EmptyStateWarning>
    );
  }

  return <ol>{formattedFunctions}</ol>;
}
