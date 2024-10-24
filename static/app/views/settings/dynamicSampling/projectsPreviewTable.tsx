import {Fragment, memo, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {InputGroup} from 'sentry/components/inputGroup';
import LoadingError from 'sentry/components/loadingError';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {MRI} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {
  type MetricsQueryApiQueryParams,
  useMetricsQuery,
} from 'sentry/utils/metrics/useMetricsQuery';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useProjects from 'sentry/utils/useProjects';
import {dynamicSamplingForm} from 'sentry/views/settings/dynamicSampling/dynamicSamplingForm';
import {balanceSampleRate} from 'sentry/views/settings/dynamicSampling/utils/rebalancing';

const {useFormField} = dynamicSamplingForm;

// TODO(aknaus): Switch to c:spans/count_per_root_project@none once available
const SPANS_COUNT_METRIC: MRI = `c:transactions/count_per_root_project@none`;
const metricsQuery: MetricsQueryApiQueryParams[] = [
  {
    mri: SPANS_COUNT_METRIC,
    aggregation: 'count',
    name: 'spans',
    groupBy: ['project'],
    orderBy: 'desc',
  },
];

export function ProjectsPreviewTable() {
  const {projects, fetching} = useProjects();
  const [tableSort, setTableSort] = useState<'asc' | 'desc'>('desc');
  const [period, setPeriod] = useState<'24h' | '30d'>('24h');
  const {value: targetSampleRate} = useFormField('targetSampleRate');

  const {data, isPending, isError, refetch} = useMetricsQuery(
    metricsQuery,
    {
      datetime: {
        start: null,
        end: null,
        utc: true,
        period,
      },
      environments: [],
      projects: [],
    },
    {
      includeSeries: false,
      interval: period === '24h' ? '1h' : '1d',
    }
  );

  const projectBySlug = useMemo(
    () =>
      projects.reduce((acc, project) => {
        acc[project.slug] = project;
        return acc;
      }, {}),
    [projects]
  );

  const items = useMemo(
    () =>
      (data?.data[0] ?? [])
        .map(item => ({
          id: item.by.project,
          project: projectBySlug[item.by.project],
          count: item.totals,
          // This is a placeholder value to satisfy typing
          // the actual value is calculated in the balanceSampleRate function
          sampleRate: 1,
        }))
        // Remove items where we cannot match the project
        .filter(item => item.project),
    [data?.data, projectBySlug]
  );

  const debouncedTargetSampleRate = useDebouncedValue(
    targetSampleRate,
    // For longer lists we debounce the input to avoid too many re-renders
    items.length > 100 ? 200 : 0
  );

  const {balancedItems} = useMemo(() => {
    const targetRate = Math.min(100, Math.max(0, Number(debouncedTargetSampleRate) || 0));
    return balanceSampleRate({
      targetSampleRate: targetRate / 100,
      items,
    });
  }, [debouncedTargetSampleRate, items]);

  if (isError) {
    return <LoadingError onRetry={() => refetch()} />;
  }

  return (
    <ProjectsTable
      stickyHeaders
      emptyMessage={t('No active projects found in the selected period.')}
      isEmpty={!items.length}
      isLoading={isPending || fetching}
      headers={[
        t('Project'),
        <div key={'spans'} style={{display: 'flex', alignItems: 'center'}}>
          {t('Spans')} {'('}
          {/* TODO(aknaus): Refine period selection or drop it */}
          <Button
            priority="link"
            onClick={() => setPeriod(value => (value === '24h' ? '30d' : '24h'))}
          >
            {period}
          </Button>
          {')'}
          &nbsp;
          <Button
            aria-label={t('Sort by Spans')}
            borderless
            size="zero"
            onClick={() => setTableSort(value => (value === 'asc' ? 'desc' : 'asc'))}
            icon={
              <IconArrow direction={tableSort === 'desc' ? 'down' : 'up'} size="xs" />
            }
          />
        </div>,
        t('Projected Rate'),
      ]}
    >
      {balancedItems
        .toSorted((a, b) => {
          if (tableSort === 'asc') {
            return a.count - b.count;
          }
          return b.count - a.count;
        })
        .map(({id, project, count, sampleRate}) => (
          <TableRow key={id} project={project} count={count} sampleRate={sampleRate} />
        ))}
    </ProjectsTable>
  );
}

const TableRow = memo(function TableRow({
  project,
  count,
  sampleRate,
}: {
  count: number;
  project: Project;
  sampleRate: number;
}) {
  // TODO(aknaus): Also display delta to initial sanmple rate
  return (
    <Fragment key={project.slug}>
      <Cell>
        <ProjectBadge project={project} avatarSize={20} />
      </Cell>
      <Cell data-align="right">
        <div>{count}</div>
      </Cell>
      <Cell>
        <Tooltip
          title={t('To edit project sample rates, switch to manual sampling mode.')}
        >
          <InputGroup
            css={css`
              width: 150px;
            `}
          >
            <InputGroup.Input
              disabled
              value={formatNumberWithDynamicDecimalPoints(sampleRate, 3)}
            />
            <InputGroup.TrailingItems>
              <TrailingPercent>%</TrailingPercent>
            </InputGroup.TrailingItems>
          </InputGroup>
        </Tooltip>
      </Cell>
    </Fragment>
  );
});

const ProjectsTable = styled(PanelTable)`
  grid-template-columns: 1fr max-content max-content;
`;

const Cell = styled('div')`
  display: flex;
  align-items: center;

  &[data-align='right'] {
    justify-content: flex-end;
  }
`;

const TrailingPercent = styled('strong')`
  padding: 0 2px;
`;
