import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import clamp from 'lodash/clamp';

import {SectionHeading} from 'sentry/components/charts/styles';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ArrayLinks} from 'sentry/components/profiling/arrayLinks';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {FIELD_FORMATTERS} from 'sentry/utils/discover/fieldRenderers';
import {getShortEventId} from 'sentry/utils/events';
import {isSampledProfile} from 'sentry/utils/profiling/guards/profile';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  Table,
  TableBody,
  TableBodyCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {getProfileTargetId} from 'sentry/views/profiling/utils';

const MAX_EXAMPLES_PER_FRAME = 5;

function sortFunctions(a: Profiling.FunctionMetric, b: Profiling.FunctionMetric) {
  return b.sumSelfTime - a.sumSelfTime;
}

type Column = {
  label: React.ReactNode;
  value: keyof Profiling.FunctionMetric;
};

const COLUMNS: Column[] = [
  {
    label: t('function'),
    value: 'name',
  },
  {
    label: t('package'),
    value: 'package',
  },
  {
    label: t('avg()'),
    value: 'avg',
  },
  {
    label: t('p75()'),
    value: 'p75',
  },
  {
    label: t('p95()'),
    value: 'p95',
  },
  {
    label: t('p99()'),
    value: 'p99',
  },
  {
    label: t('examples'),
    value: 'examples',
  },
];

function shouldSkipFrame(
  frame: Omit<Profiling.Frame, 'key'> | undefined,
  frameInfo: Profiling.FrameInfo | undefined
): boolean {
  if (!frame || !frameInfo) {
    return true;
  }

  if (!frameInfo.sumSelfTime) {
    return true;
  }

  if (!frame.is_application) {
    return true;
  }

  if (!defined(frame.fingerprint) || !frame.name || !frame.image) {
    return true;
  }

  return false;
}

interface SuspectFunctionsTableProps {
  analyticsPageSource: 'performance_transaction' | 'profiling_transaction';
  eventView: EventView;
  project?: Project;
}

export function SuspectFunctionsTable({
  analyticsPageSource,
  eventView,
  project,
}: SuspectFunctionsTableProps) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();

  const flamegraphQuery = useAggregateFlamegraphQuery({
    // User query is only permitted when using transactions.
    // If this is to be reused for strictly continuous profiling,
    // it'll need to be swapped to use the `profiles` data source
    // with no user query.
    dataSource: 'transactions',
    query: eventView.query,
    metrics: true,
  });

  const sortedMetrics = useMemo(() => {
    const frames = flamegraphQuery.data?.shared?.frames ?? [];
    const frameInfos = flamegraphQuery.data?.shared?.frame_infos ?? [];
    const profileExamples = flamegraphQuery.data?.shared?.profiles ?? [];

    const examples: Array<Array<Exclude<Profiling.ProfileReference, string>>> = new Array(
      frames.length
    );

    for (const profile of flamegraphQuery.data?.profiles ?? []) {
      if (isSampledProfile(profile)) {
        for (let i = 0; i < profile.samples.length; i++) {
          const sample = profile.samples[i]!;
          const sampleExamples = profile.samples_examples?.[i];
          if (!defined(sampleExamples)) {
            continue;
          }
          for (const frameIndex of sample) {
            const frame = frames[frameIndex];
            const frameInfo = frameInfos[frameIndex];
            if (shouldSkipFrame(frame, frameInfo)) {
              continue;
            }

            const examplesForFrame = examples[frameIndex] || [];
            for (const sampleExampleIndex of sampleExamples) {
              if (examplesForFrame.length >= MAX_EXAMPLES_PER_FRAME) {
                break;
              }
              const sampleExample = profileExamples[sampleExampleIndex];
              if (defined(sampleExample) && typeof sampleExample !== 'string') {
                examplesForFrame.push(sampleExample);
              }
            }
            examples[frameIndex] = examplesForFrame;
          }
        }
      }
    }

    const metrics: Profiling.FunctionMetric[] = [];

    for (let i = 0; i < frames.length && i < frameInfos.length; i++) {
      const frame = frames[i]!;
      const frameInfo = frameInfos[i];
      if (!frameInfo) {
        continue;
      }
      if (shouldSkipFrame(frame, frameInfo)) {
        continue;
      }

      const frameExamples:
        | Array<Exclude<Profiling.ProfileReference, string>>
        | undefined = examples[i];
      if (!frameExamples?.length) {
        continue;
      }

      metrics.push({
        fingerprint: frame.fingerprint || 0,
        in_app: frame.is_application || false,
        name: frame.name,
        package: frame.image || '',
        avg: frameInfo.sumDuration / frameInfo.count,
        count: frameInfo.count,
        sum: frameInfo.sumDuration,
        sumSelfTime: frameInfo.sumSelfTime,
        p75: frameInfo.p75Duration,
        p95: frameInfo.p95Duration,
        p99: frameInfo.p99Duration,
        examples: frameExamples,
      });
    }

    return metrics.sort(sortFunctions);
  }, [flamegraphQuery.data]);

  const pagination = useMemoryPagination(sortedMetrics, 5);

  const metrics = useMemo(() => {
    return sortedMetrics.slice(pagination.start, pagination.end);
  }, [sortedMetrics, pagination]);

  const fields = COLUMNS.map(column => column.value);
  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles} = useTableStyles(fields, tableRef);

  const baggage: RenderFunctionBaggage = {
    location,
    organization,
    theme,
    unit: 'nanosecond',
  };

  return (
    <Fragment>
      <TableHeader>
        <SectionHeading>{t('Suspect Functions')}</SectionHeading>
        <ButtonBar merged gap="0">
          <Button
            icon={<IconChevron direction="left" />}
            aria-label={t('Previous')}
            size="xs"
            {...pagination.previousButtonProps}
          />
          <Button
            icon={<IconChevron direction="right" />}
            aria-label={t('Next')}
            size="xs"
            {...pagination.nextButtonProps}
          />
        </ButtonBar>
      </TableHeader>
      <Table ref={tableRef} style={initialTableStyles}>
        <TableHead>
          <TableRow>
            {COLUMNS.map((column, i) => {
              return (
                <TableHeadCell
                  key={i}
                  isFirst={i === 0}
                  align={
                    column.value === 'package' || column.value === 'name'
                      ? 'left'
                      : 'right'
                  }
                >
                  {column.label}
                </TableHeadCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {flamegraphQuery.isPending ? (
            <TableStatus>
              <LoadingIndicator />
            </TableStatus>
          ) : flamegraphQuery.isError ? (
            <TableStatus>
              <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
            </TableStatus>
          ) : flamegraphQuery.isFetched ? (
            metrics.map((metric, i) => (
              <TableEntry
                key={i}
                analyticsPageSource={analyticsPageSource}
                baggage={baggage}
                metric={metric}
                organization={organization}
                project={project}
              />
            ))
          ) : (
            <TableStatus>
              <EmptyStateWarning>
                <p>{t('No functions found')}</p>
              </EmptyStateWarning>
            </TableStatus>
          )}
        </TableBody>
      </Table>
    </Fragment>
  );
}

interface TableEntryProps {
  analyticsPageSource: 'performance_transaction' | 'profiling_transaction';
  baggage: RenderFunctionBaggage;
  metric: Profiling.FunctionMetric;
  organization: Organization;
  project?: Project;
}

function TableEntry({
  analyticsPageSource,
  baggage,
  metric,
  organization,
  project,
}: TableEntryProps) {
  return (
    <TableRow>
      {COLUMNS.map(column => {
        if (column.value === 'examples') {
          const items = metric[column.value].map(example => {
            return {
              value: getShortEventId(getProfileTargetId(example)),
              onClick: () => {
                const source =
                  analyticsPageSource === 'performance_transaction'
                    ? 'performance.transactions_summary.suspect_functions'
                    : 'unknown';
                trackAnalytics('profiling_views.go_to_flamegraph', {
                  organization,
                  source,
                });
              },
              target: generateProfileRouteFromProfileReference({
                organization,
                projectSlug: project?.slug || '',
                reference: example,
                // specify the frame to focus, the flamegraph will switch
                // to the appropriate thread when these are specified
                frameName: metric.name,
                framePackage: metric.package,
              }),
            };
          });
          return (
            <TableBodyCell key={column.value}>
              <ArrayLinks items={items} />
            </TableBodyCell>
          );
        }

        const formatter =
          typeof metric[column.value] === 'number'
            ? FIELD_FORMATTERS.duration.renderFunc
            : FIELD_FORMATTERS.string.renderFunc;
        return (
          <TableBodyCell key={column.value}>
            {formatter(column.value, metric, baggage)}
          </TableBodyCell>
        );
      })}
    </TableRow>
  );
}

function useMemoryPagination(items: any[], size: number) {
  const [pagination, setPagination] = useState({
    start: 0,
    end: size,
  });

  const page = Math.floor(pagination.start / size);
  const toPage = useCallback(
    (p: number) => {
      const next = clamp(p, 0, Math.floor(items.length / size));

      setPagination({
        start: clamp(next * size, 0, items.length - size),
        end: Math.min(next * size + size, items.length),
      });
    },
    [size, items]
  );

  return {
    page,
    start: pagination.start,
    end: pagination.end,
    nextButtonProps: {
      disabled: pagination.end >= items.length,
      onClick: () => toPage(page + 1),
    },
    previousButtonProps: {
      disabled: pagination.start <= 0,
      onClick: () => toPage(page - 1),
    },
  };
}

const TableHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;
