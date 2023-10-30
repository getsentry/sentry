import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {LineChart} from 'sentry/components/charts/lineChart';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getDuration} from 'sentry/utils/formatters';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {useProfileTopEventsStats} from 'sentry/utils/profiling/hooks/useProfileTopEventsStats';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {
  generateProfileFlamechartRouteWithQuery,
  generateProfileSummaryRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';

interface EventAffectedTransactionsProps {
  event: Event;
  group: Group;
  project: Project;
}

export function EventAffectedTransactions({
  event,
  project,
}: EventAffectedTransactionsProps) {
  const evidenceData = event.occurrence?.evidenceData;
  const fingerprint = evidenceData?.fingerprint;
  const breakpoint = evidenceData?.breakpoint;
  const frameName = evidenceData?.function;
  const framePackage = evidenceData?.package || evidenceData?.module;

  const isValid = defined(fingerprint) && defined(breakpoint);

  useEffect(() => {
    if (isValid) {
      return;
    }

    Sentry.withScope(scope => {
      scope.setContext('evidence data fields', {
        fingerprint,
        breakpoint,
      });

      Sentry.captureException(
        new Error('Missing required evidence data on function regression issue.')
      );
    });
  }, [isValid, fingerprint, breakpoint]);

  if (!isValid) {
    return null;
  }

  return (
    <EventAffectedTransactionsInner
      breakpoint={breakpoint}
      fingerprint={fingerprint}
      frameName={frameName}
      framePackage={framePackage}
      project={project}
    />
  );
}

const TRANSACTIONS_LIMIT = 5;

interface EventAffectedTransactionsInnerProps {
  breakpoint: number;
  fingerprint: number;
  frameName: string;
  framePackage: string;
  project: Project;
}

function EventAffectedTransactionsInner({
  breakpoint,
  fingerprint,
  frameName,
  framePackage,
  project,
}: EventAffectedTransactionsInnerProps) {
  const organization = useOrganization();

  const datetime = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 14,
  });

  const percentileBefore = `percentile_before(function.duration, 0.95, ${breakpoint})`;
  const percentileAfter = `percentile_after(function.duration, 0.95, ${breakpoint})`;
  const regressionScore = `regression_score(function.duration, 0.95, ${breakpoint})`;

  const transactionsDeltaQuery = useProfileFunctions({
    datetime,
    fields: ['transaction', percentileBefore, percentileAfter, regressionScore],
    sort: {
      key: regressionScore,
      order: 'desc',
    },
    query: `fingerprint:${fingerprint} ${regressionScore}:>0`,
    projects: [project.id],
    limit: TRANSACTIONS_LIMIT,
    referrer: 'api.profiling.functions.regression.transactions',
  });

  const query = useMemo(() => {
    const data = transactionsDeltaQuery.data?.data ?? [];
    if (!data.length) {
      return null;
    }

    const conditions = new MutableSearch('');
    conditions.addFilterValue('fingerprint', String(fingerprint), true);
    conditions.addOp('(');
    for (let i = 0; i < data.length; i++) {
      if (i > 0) {
        conditions.addOp('OR');
      }
      conditions.addFilterValue('transaction', data[i].transaction as string, true);
    }
    conditions.addOp(')');
    return conditions.formatString();
  }, [fingerprint, transactionsDeltaQuery]);

  const functionStats = useProfileTopEventsStats({
    dataset: 'profileFunctions',
    datetime,
    fields: ['transaction', 'count()'],
    query: query ?? '',
    enabled: defined(query),
    others: false,
    referrer: 'api.profiling.functions.regression.transaction-stats',
    topEvents: TRANSACTIONS_LIMIT,
    yAxes: ['p95()', 'worst()'],
  });

  const examplesByTransaction = useMemo(() => {
    const allExamples: Record<string, [string | null, string | null]> = {};
    if (!defined(functionStats.data)) {
      return allExamples;
    }

    const timestamps = functionStats.data.timestamps;
    const breakpointIndex = timestamps.indexOf(breakpoint);
    if (breakpointIndex < 0) {
      return allExamples;
    }

    transactionsDeltaQuery.data?.data?.forEach(row => {
      const transaction = row.transaction as string;
      const data = functionStats.data.data.find(
        ({axis, label}) => axis === 'worst()' && label === transaction
      );
      if (!defined(data)) {
        return;
      }

      allExamples[transaction] = findExamplePair(data.values, breakpointIndex);
    });

    return allExamples;
  }, [breakpoint, transactionsDeltaQuery, functionStats]);

  const timeseriesByTransaction: Record<string, Series> = useMemo(() => {
    const allTimeseries: Record<string, Series> = {};
    if (!defined(functionStats.data)) {
      return allTimeseries;
    }

    const timestamps = functionStats.data.timestamps;

    transactionsDeltaQuery.data?.data?.forEach(row => {
      const transaction = row.transaction as string;
      const data = functionStats.data.data.find(
        ({axis, label}) => axis === 'p95()' && label === transaction
      );
      if (!defined(data)) {
        return;
      }

      allTimeseries[transaction] = {
        data: timestamps.map((timestamp, i) => {
          return {
            name: timestamp * 1000,
            value: data.values[i],
          };
        }),
        seriesName: 'p95(function.duration)',
      };
    });

    return allTimeseries;
  }, [transactionsDeltaQuery, functionStats]);

  const chartOptions = useMemo(() => {
    return {
      width: 300,
      height: 20,
      grid: {
        top: '2px',
        left: '2px',
        right: '2px',
        bottom: '2px',
        containLabel: false,
      },
      xAxis: {
        show: false,
        type: 'time' as const,
      },
      yAxis: {
        show: false,
      },
      tooltip: {
        valueFormatter: value => tooltipFormatter(value, 'duration'),
      },
    };
  }, []);

  function handleGoToProfile() {
    trackAnalytics('profiling_views.go_to_flamegraph', {
      organization,
      source: 'profiling.issue.function_regression.transactions',
    });
  }

  return (
    <EventDataSection type="transactions-impacted" title={t('Transactions Impacted')}>
      {transactionsDeltaQuery.isLoading ? (
        <LoadingIndicator hideMessage />
      ) : transactionsDeltaQuery.isError ? (
        <EmptyStateWarning>
          <p>{t('Oops! Something went wrong fetching transaction impacted.')}</p>
        </EmptyStateWarning>
      ) : (
        <ListContainer>
          {(transactionsDeltaQuery.data?.data ?? []).map(transaction => {
            const transactionName = transaction.transaction as string;
            const series = timeseriesByTransaction[transactionName] ?? {
              seriesName: 'p95()',
              data: [],
            };

            const [beforeExample, afterExample] = examplesByTransaction[
              transactionName
            ] ?? [null, null];

            let before = (
              <PerformanceDuration
                nanoseconds={transaction[percentileBefore] as number}
                abbreviation
              />
            );

            if (defined(beforeExample)) {
              const beforeTarget = generateProfileFlamechartRouteWithQuery({
                orgSlug: organization.slug,
                projectSlug: project.slug,
                profileId: beforeExample,
                query: {
                  frameName,
                  framePackage,
                },
              });

              before = (
                <Link to={beforeTarget} onClick={handleGoToProfile}>
                  {before}
                </Link>
              );
            }

            let after = (
              <PerformanceDuration
                nanoseconds={transaction[percentileAfter] as number}
                abbreviation
              />
            );

            if (defined(afterExample)) {
              const afterTarget = generateProfileFlamechartRouteWithQuery({
                orgSlug: organization.slug,
                projectSlug: project.slug,
                profileId: afterExample,
                query: {
                  frameName,
                  framePackage,
                },
              });

              after = (
                <Link to={afterTarget} onClick={handleGoToProfile}>
                  {after}
                </Link>
              );
            }

            const summaryTarget = generateProfileSummaryRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug: project.slug,
              transaction: transaction.transaction as string,
            });
            return (
              <Fragment key={transaction.transaction as string}>
                <Container>
                  <Link to={summaryTarget}>{transaction.transaction}</Link>
                </Container>
                <LineChart
                  {...chartOptions}
                  series={[series]}
                  isGroupedByDate
                  showTimeInTooltip
                />
                <NumberContainer>
                  <Tooltip
                    title={tct(
                      'The function duration in this transaction increased from [before] to [after]',
                      {
                        before: getDuration(
                          (transaction[percentileBefore] as number) / 1_000_000_000,
                          2,
                          true
                        ),
                        after: getDuration(
                          (transaction[percentileAfter] as number) / 1_000_000_000,
                          2,
                          true
                        ),
                      }
                    )}
                    position="top"
                  >
                    <DurationChange>
                      {before}
                      <IconArrow direction="right" size="xs" />
                      {after}
                    </DurationChange>
                  </Tooltip>
                </NumberContainer>
              </Fragment>
            );
          })}
        </ListContainer>
      )}
    </EventDataSection>
  );
}

/**
 * Find an example pair of profile ids from before and after the breakpoint.
 *
 * We prioritize profile ids from outside some window around the breakpoint
 * because the breakpoint is not 100% accurate and giving a buffer around
 * the breakpoint to so we can more accurate get a example profile from
 * before and after ranges.
 *
 * @param examples list of example profile ids
 * @param breakpointIndex the index where the breakpoint is
 * @param window the window around the breakpoint to deprioritize
 */
function findExamplePair(
  examples: string[],
  breakpointIndex,
  window = 3
): [string | null, string | null] {
  let before: string | null = null;

  for (let i = breakpointIndex - window; i < examples.length && i >= 0; i--) {
    if (examples[i]) {
      before = examples[i];
      break;
    }
  }

  if (!defined(before)) {
    for (
      let i = breakpointIndex;
      i < examples.length && i > breakpointIndex - window;
      i--
    ) {
      if (examples[i]) {
        before = examples[i];
        break;
      }
    }
  }

  let after: string | null = null;

  for (let i = breakpointIndex + window; i < examples.length; i++) {
    if (examples[i]) {
      after = examples[i];
      break;
    }
  }

  if (!defined(before)) {
    for (let i = breakpointIndex; i < breakpointIndex + window; i++) {
      if (examples[i]) {
        after = examples[i];
        break;
      }
    }
  }

  return [before, after];
}

const ListContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: ${space(1)};
`;

const DurationChange = styled('span')`
  color: ${p => p.theme.gray300};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
