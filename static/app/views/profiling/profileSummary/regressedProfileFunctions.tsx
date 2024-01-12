import {useCallback, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {TextTruncateOverflow} from 'sentry/components/profiling/textTruncateOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatPercentage} from 'sentry/utils/formatters';
import type {FunctionTrend, TrendType} from 'sentry/utils/profiling/hooks/types';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useProfileFunctionTrends} from 'sentry/utils/profiling/hooks/useProfileFunctionTrends';
import {
  generateProfileDifferentialFlamegraphRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {relativeChange} from 'sentry/utils/profiling/units/units';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {ProfilingSparklineChart} from './profilingSparklineChart';

const REGRESSED_FUNCTIONS_LIMIT = 5;
const REGRESSED_FUNCTIONS_CURSOR = 'functionRegressionCursor';

function trendToPoints(trend: FunctionTrend): {timestamp: number; value: number}[] {
  if (!trend.stats.data.length) {
    return [];
  }

  return trend.stats.data.map(p => {
    return {
      timestamp: p[0],
      value: p[1][0].count,
    };
  });
}

function findBreakPointIndex(
  breakpoint: number,
  worst: FunctionTrend['worst']
): number | undefined {
  let low = 0;
  let high = worst.length - 1;
  let mid = 0;
  let bestMatch: number | undefined;

  // eslint-disable-next-line
  while (low <= high) {
    mid = Math.floor((low + high) / 2);
    const value = worst[mid][0];

    if (breakpoint === value) {
      return mid;
    }

    if (breakpoint > value) {
      low = mid + 1;
      bestMatch = mid;
    } else if (breakpoint < value) {
      high = mid - 1;
    }
  }

  // We dont need an exact match as the breakpoint is not guaranteed to be
  // in the worst array, so we return the closest index
  return bestMatch;
}

function findWorstProfileIDBeforeAndAfter(trend: FunctionTrend): {
  after: string;
  before: string;
} {
  const breakPointIndex = findBreakPointIndex(trend.breakpoint, trend.worst);

  if (breakPointIndex === undefined) {
    throw new Error('Could not find breakpoint index');
  }

  let beforeProfileID = '';
  let afterProfileID = '';

  const STABILITY_WINDOW = 2 * 60 * 1000;
  for (let i = breakPointIndex; i >= 0; i--) {
    if (trend.worst[i][0] < trend.breakpoint - STABILITY_WINDOW) {
      break;
    }

    beforeProfileID = trend.worst[i][1];
  }

  for (let i = breakPointIndex; i < trend.worst.length; i++) {
    if (trend.worst[i][0] > trend.breakpoint + STABILITY_WINDOW) {
      break;
    }
    afterProfileID = trend.worst[i][1];
  }

  return {
    before: beforeProfileID,
    after: afterProfileID,
  };
}

interface MostRegressedProfileFunctionsProps {
  transaction: string;
}

export function MostRegressedProfileFunctions(props: MostRegressedProfileFunctionsProps) {
  const organization = useOrganization();
  const project = useCurrentProjectFromRouteParam();
  const location = useLocation();
  const theme = useTheme();

  const fnTrendCursor = useMemo(
    () => decodeScalar(location.query[REGRESSED_FUNCTIONS_CURSOR]),
    [location.query]
  );

  const handleRegressedFunctionsCursor = useCallback((cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [REGRESSED_FUNCTIONS_CURSOR]: cursor},
    });
  }, []);

  const functionQuery = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('is_application', ['1']);
    conditions.setFilterValues('transaction', [props.transaction]);
    return conditions.formatString();
  }, [props.transaction]);

  const [trendType, setTrendType] = useState<TrendType>('regression');
  const trendsQuery = useProfileFunctionTrends({
    trendFunction: 'p95()',
    trendType,
    query: functionQuery,
    limit: REGRESSED_FUNCTIONS_LIMIT,
    cursor: fnTrendCursor,
  });

  const trends = trendsQuery?.data ?? [];

  const onChangeTrendType = useCallback(v => setTrendType(v.value), []);

  const hasDifferentialFlamegraphPageFeature = organization.features.includes(
    'profiling-differential-flamegraph-page'
  );

  return (
    <RegressedFunctionsContainer>
      <RegressedFunctionsTitleContainer>
        <RegressedFunctionsTypeSelect
          value={trendType}
          options={TREND_FUNCTION_OPTIONS}
          onChange={onChangeTrendType}
          triggerProps={TRIGGER_PROPS}
          offset={4}
        />
        <RegressedFunctionsPagination
          pageLinks={trendsQuery.getResponseHeader?.('Link')}
          onCursor={handleRegressedFunctionsCursor}
          size="xs"
        />
      </RegressedFunctionsTitleContainer>
      {trendsQuery.isLoading ? (
        <RegressedFunctionsQueryState>
          <LoadingIndicator size={36} />
        </RegressedFunctionsQueryState>
      ) : trendsQuery.isError ? (
        <RegressedFunctionsQueryState>
          {t('Failed to fetch regressed functions')}
        </RegressedFunctionsQueryState>
      ) : !trends.length ? (
        <RegressedFunctionsQueryState>
          {trendType === 'regression' ? (
            <p>{t('No regressed functions detected')}</p>
          ) : (
            <p>{t('No improved functions detected')}</p>
          )}
        </RegressedFunctionsQueryState>
      ) : (
        trends.map((fn, i) => {
          const {before, after} = findWorstProfileIDBeforeAndAfter(fn);
          return (
            <RegressedFunctionRow key={i}>
              {hasDifferentialFlamegraphPageFeature ? (
                <RegressedFunctionDifferentialFlamegraph
                  transaction={props.transaction}
                  organization={organization}
                  project={project}
                  fn={fn}
                />
              ) : (
                <RegressedFunctionBeforeAfterFlamechart
                  organization={organization}
                  project={project}
                  before={before}
                  after={after}
                  fn={fn}
                />
              )}
              <RegressedFunctionMetricsRow>
                <div>
                  <TextTruncateOverflow>{fn.package}</TextTruncateOverflow>
                </div>
                <div>
                  {/* We dont handle improvements as formatPercentage and relativeChange
                  on lines below dont return absolute values, else we end up with a double sign */}
                  {trendType === 'regression'
                    ? fn.aggregate_range_1 < fn.aggregate_range_2
                      ? '+'
                      : '-'
                    : null}
                  {formatPercentage(
                    relativeChange(fn.aggregate_range_2, fn.aggregate_range_1)
                  )}
                </div>
              </RegressedFunctionMetricsRow>
              <RegressedFunctionSparklineContainer>
                <ProfilingSparklineChart
                  name="p95(function.duration)"
                  points={trendToPoints(fn)}
                  color={trendType === 'improvement' ? theme.green300 : theme.red300}
                  aggregate_range_1={fn.aggregate_range_1}
                  aggregate_range_2={fn.aggregate_range_2}
                  breakpoint={fn.breakpoint}
                  start={fn.stats.data[0][0]}
                  end={fn.stats.data[fn.stats.data.length - 1][0]}
                />
              </RegressedFunctionSparklineContainer>
            </RegressedFunctionRow>
          );
        })
      )}
    </RegressedFunctionsContainer>
  );
}

interface RegressedFunctionDifferentialFlamegraphProps {
  fn: FunctionTrend;
  organization: Organization;
  project: Project | null;
  transaction: string;
}

function RegressedFunctionDifferentialFlamegraph(
  props: RegressedFunctionDifferentialFlamegraphProps
) {
  const onRegressedFunctionClick = useCallback(() => {
    trackAnalytics('profiling_views.go_to_differential_flamegraph', {
      organization: props.organization,
      source: `profiling_transaction.regressed_functions_table`,
    });
  }, [props.organization]);

  const differentialFlamegraphLink = generateProfileDifferentialFlamegraphRouteWithQuery({
    orgSlug: props.organization.slug,
    projectSlug: props.project?.slug ?? '',
    transaction: props.transaction,
    fingerprint: props.fn.fingerprint,
    breakpoint: props.fn.breakpoint,
    query: {
      // specify the frame to focus, the flamegraph will switch
      // to the appropriate thread when these are specified
      frameName: props.fn.function as string,
      framePackage: props.fn.package as string,
    },
  });

  return (
    <RegressedFunctionMainRow>
      <div>
        <Link onClick={onRegressedFunctionClick} to={differentialFlamegraphLink}>
          <TextTruncateOverflow>{props.fn.function}</TextTruncateOverflow>
        </Link>
      </div>
      <div>
        <Link onClick={onRegressedFunctionClick} to={differentialFlamegraphLink}>
          <PerformanceDuration
            abbreviation
            nanoseconds={props.fn.aggregate_range_1 as number}
          />
          <ChangeArrow>{' \u2192 '}</ChangeArrow>
          <PerformanceDuration
            abbreviation
            nanoseconds={props.fn.aggregate_range_2 as number}
          />
        </Link>
      </div>
    </RegressedFunctionMainRow>
  );
}

interface RegressedFunctionBeforeAfterProps {
  after: string;
  before: string;
  fn: FunctionTrend;
  organization: Organization;
  project: Project | null;
}

function RegressedFunctionBeforeAfterFlamechart(
  props: RegressedFunctionBeforeAfterProps
) {
  const onRegressedFunctionClick = useCallback(() => {
    trackAnalytics('profiling_views.go_to_flamegraph', {
      organization: props.organization,
      source: `profiling_transaction.regressed_functions_table`,
    });
  }, [props.organization]);

  return (
    <RegressedFunctionMainRow>
      <div>
        <Link
          onClick={onRegressedFunctionClick}
          to={generateProfileFlamechartRouteWithQuery({
            orgSlug: props.organization.slug,
            projectSlug: props.project?.slug ?? '',
            profileId: (props.fn['examples()']?.[0] as string) ?? '',
            query: {
              // specify the frame to focus, the flamegraph will switch
              // to the appropriate thread when these are specified
              frameName: props.fn.function as string,
              framePackage: props.fn.package as string,
            },
          })}
        >
          <TextTruncateOverflow>{props.fn.function}</TextTruncateOverflow>
        </Link>
      </div>
      <div>
        <Link
          onClick={onRegressedFunctionClick}
          to={generateProfileFlamechartRouteWithQuery({
            orgSlug: props.organization.slug,
            projectSlug: props.project?.slug ?? '',
            profileId: props.before,
            query: {
              // specify the frame to focus, the flamegraph will switch
              // to the appropriate thread when these are specified
              frameName: props.fn.function as string,
              framePackage: props.fn.package as string,
            },
          })}
        >
          <PerformanceDuration
            abbreviation
            nanoseconds={props.fn.aggregate_range_1 as number}
          />
        </Link>
        <ChangeArrow>{' \u2192 '}</ChangeArrow>
        <Link
          onClick={onRegressedFunctionClick}
          to={generateProfileFlamechartRouteWithQuery({
            orgSlug: props.organization.slug,
            projectSlug: props.project?.slug ?? '',
            profileId: props.after,
            query: {
              // specify the frame to focus, the flamegraph will switch
              // to the appropriate thread when these are specified
              frameName: props.fn.function as string,
              framePackage: props.fn.package as string,
            },
          })}
        >
          <PerformanceDuration
            abbreviation
            nanoseconds={props.fn.aggregate_range_2 as number}
          />
        </Link>
      </div>
    </RegressedFunctionMainRow>
  );
}

const ChangeArrow = styled('span')`
  color: ${p => p.theme.subText};
`;

const RegressedFunctionsTypeSelect = styled(CompactSelect)`
  button {
    margin: 0;
    padding: 0;
  }
`;

const RegressedFunctionSparklineContainer = styled('div')``;

const RegressedFunctionRow = styled('div')`
  position: relative;
  margin-bottom: ${space(1)};
`;

const RegressedFunctionMainRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  > div:first-child {
    min-width: 0;
  }
  > div:last-child {
    white-space: nowrap;
  }
`;

const RegressedFunctionMetricsRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
`;

const RegressedFunctionsContainer = styled('div')`
  flex-basis: 80px;
  padding: 0 ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const RegressedFunctionsPagination = styled(Pagination)`
  margin: 0;

  button {
    height: 16px;
    width: 16px;
    min-width: 16px;
    min-height: 16px;

    svg {
      width: 10px;
      height: 10px;
    }
  }
`;

const RegressedFunctionsTitleContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(0.5)};
  margin-top: ${space(0.5)};
`;

const RegressedFunctionsQueryState = styled('div')`
  text-align: center;
  padding: ${space(2)} ${space(0.5)};
  color: ${p => p.theme.subText};
`;

const TRIGGER_PROPS = {borderless: true, size: 'zero' as const};
const TREND_FUNCTION_OPTIONS: SelectOption<TrendType>[] = [
  {
    label: t('Most Regressed Functions'),
    value: 'regression' as const,
  },
  {
    label: t('Most Improved Functions'),
    value: 'improvement' as const,
  },
];
