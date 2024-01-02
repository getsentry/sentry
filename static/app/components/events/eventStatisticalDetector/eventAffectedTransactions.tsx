import {useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {Event, Group, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useProfileTopEventsStats} from 'sentry/utils/profiling/hooks/useProfileTopEventsStats';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {
  generateProfileFlamechartRouteWithQuery,
  generateProfileSummaryRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';

import {RELATIVE_DAYS_WINDOW} from './consts';
import {EventRegressionTable} from './eventRegressionTable';
import {useTransactionsDelta} from './transactionsDeltaProvider';

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

const TRANSACTIONS_LIMIT = 10;

const ADDITIONAL_COLUMNS = [
  {key: 'transaction', name: t('Transaction'), width: COL_WIDTH_UNDEFINED},
];

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
  const [causeType, setCauseType] = useState<'duration' | 'throughput'>('duration');
  const organization = useOrganization();

  const datetime = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: RELATIVE_DAYS_WINDOW,
  });

  const transactionsDeltaQuery = useTransactionsDelta();

  const percentileBefore = `percentile_before(function.duration, 0.95, ${breakpoint})`;
  const percentileAfter = `percentile_after(function.duration, 0.95, ${breakpoint})`;
  const throughputBefore = `cpm_before(${breakpoint})`;
  const throughputAfter = `cpm_after(${breakpoint})`;

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
    yAxes: ['worst()'],
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

  const tableData = useMemo(() => {
    return (
      transactionsDeltaQuery.data?.data.map(row => {
        const [exampleBefore, exampleAfter] = examplesByTransaction[
          row.transaction as string
        ] ?? [null, null];

        if (causeType === 'throughput') {
          const before = row[throughputBefore] as number;
          const after = row[throughputAfter] as number;
          return {
            exampleBefore,
            exampleAfter,
            transaction: row.transaction,
            throughputBefore: before,
            throughputAfter: after,
            percentageChange: after / before - 1,
          };
        }

        const before = (row[percentileBefore] as number) / 1e9;
        const after = (row[percentileAfter] as number) / 1e9;
        return {
          exampleBefore,
          exampleAfter,
          transaction: row.transaction,
          durationBefore: before,
          durationAfter: after,
          percentageChange: after / before - 1,
        };
      }) || []
    );
  }, [
    causeType,
    percentileBefore,
    percentileAfter,
    throughputBefore,
    throughputAfter,
    transactionsDeltaQuery.data?.data,
    examplesByTransaction,
  ]);

  const options = useMemo(() => {
    function handleGoToProfile() {
      trackAnalytics('profiling_views.go_to_flamegraph', {
        organization,
        source: 'profiling.issue.function_regression.transactions',
      });
    }

    const before = dataRow =>
      defined(dataRow.exampleBefore)
        ? {
            target: generateProfileFlamechartRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug: project.slug,
              profileId: dataRow.exampleBefore,
              query: {
                frameName,
                framePackage,
              },
            }),
            onClick: handleGoToProfile,
          }
        : undefined;

    const after = dataRow =>
      defined(dataRow.exampleAfter)
        ? {
            target: generateProfileFlamechartRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug: project.slug,
              profileId: dataRow.exampleAfter,
              query: {
                frameName,
                framePackage,
              },
            }),
            onClick: handleGoToProfile,
          }
        : undefined;

    return {
      transaction: {
        link: dataRow => ({
          target: generateProfileSummaryRouteWithQuery({
            orgSlug: organization.slug,
            projectSlug: project.slug,
            transaction: dataRow.transaction as string,
          }),
        }),
      },
      durationBefore: {link: before},
      durationAfter: {link: after},
      throughputBefore: {link: before},
      throughputAfter: {link: after},
    };
  }, [organization, project, frameName, framePackage]);

  return (
    <EventDataSection
      type="most-affected"
      title={t('Most Affected')}
      actions={
        <SegmentedControl
          size="xs"
          aria-label={t('Duration or Throughput')}
          value={causeType}
          onChange={setCauseType}
        >
          <SegmentedControl.Item key="duration">
            {t('Duration (P95)')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="throughput">
            {t('Throughput')}
          </SegmentedControl.Item>
        </SegmentedControl>
      }
    >
      <EventRegressionTable
        causeType={causeType}
        columns={ADDITIONAL_COLUMNS}
        data={tableData || []}
        isLoading={transactionsDeltaQuery.isLoading}
        isError={transactionsDeltaQuery.isError}
        options={options}
      />
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
