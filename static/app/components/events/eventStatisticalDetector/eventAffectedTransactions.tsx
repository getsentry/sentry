import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {LineChart} from 'sentry/components/charts/lineChart';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getDuration} from 'sentry/utils/formatters';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {useProfileTopEventsStats} from 'sentry/utils/profiling/hooks/useProfileTopEventsStats';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {generateProfileSummaryRouteWithQuery} from 'sentry/utils/profiling/routes';
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
      project={project}
    />
  );
}

const TRANSACTIONS_LIMIT = 5;

interface EventAffectedTransactionsInnerProps {
  breakpoint: number;
  fingerprint: number;
  project: Project;
}

function EventAffectedTransactionsInner({
  breakpoint,
  fingerprint,
  project,
}: EventAffectedTransactionsInnerProps) {
  const organization = useOrganization();

  const datetime = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 14,
  });

  const percentileBefore = `percentile_before(function.duration, 0.95, ${breakpoint})`;
  const percentileAfter = `percentile_after(function.duration, 0.95, ${breakpoint})`;
  const percentileDelta = `percentile_delta(function.duration, 0.95, ${breakpoint})`;

  const transactionsDeltaQuery = useProfileFunctions({
    datetime,
    fields: ['transaction', percentileBefore, percentileAfter, percentileDelta],
    sort: {
      key: percentileDelta,
      order: 'desc',
    },
    query: `fingerprint:${fingerprint} ${percentileDelta}:>0`,
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
    referrer: 'api.profiling.functions.regression.stats', // TODO: update this
    topEvents: TRANSACTIONS_LIMIT,
    yAxes: ['p95()', 'worst()'],
  });

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
        seriesName: 'p95()',
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

  return (
    <EventDataSection type="transactions-impacted" title={t('Transactions Impacted')}>
      <ListContainer>
        {(transactionsDeltaQuery.data?.data ?? []).map(transaction => {
          const series = timeseriesByTransaction[transaction.transaction as string] ?? {
            seriesName: 'p95()',
            data: [],
          };

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
                    <PerformanceDuration
                      nanoseconds={transaction[percentileBefore] as number}
                      abbreviation
                    />
                    <IconArrow direction="right" size="xs" />
                    <PerformanceDuration
                      nanoseconds={transaction[percentileAfter] as number}
                      abbreviation
                    />
                  </DurationChange>
                </Tooltip>
              </NumberContainer>
            </Fragment>
          );
        })}
      </ListContainer>
    </EventDataSection>
  );
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
