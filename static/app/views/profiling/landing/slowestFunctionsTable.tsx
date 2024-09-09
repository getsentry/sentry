import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import clamp from 'lodash/clamp';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {LineChart, type LineChartProps} from 'sentry/components/charts/lineChart';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {getShortEventId} from 'sentry/utils/events';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useProfilingFunctionMetrics} from 'sentry/utils/profiling/hooks/useProfilingFunctionMetrics';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  Table,
  TableBody,
  TableBodyCell,
  TableHead,
  TableHeadCell,
  TableHeader,
  TableHeaderActions,
  TableHeaderTitle,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

function sortFunctions(a: Profiling.FunctionMetric, b: Profiling.FunctionMetric) {
  return b.sum - a.sum;
}
function makeProfileLinkFromExample(
  organization: Organization,
  f: Profiling.FunctionMetric,
  example: Profiling.FunctionMetric['examples'][0],
  projectsLookupTable: Record<string, Project>
) {
  if ('project_id' in example) {
    return generateProfileRouteFromProfileReference({
      frameName: f.name,
      framePackage: f.package,
      orgSlug: organization.slug,
      projectSlug: projectsLookupTable[example.project_id]?.slug,
      reference: example,
    });
  }
  return null;
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

export function SlowestFunctionsTable({userQuery}: {userQuery?: string}) {
  const {projects} = useProjects();

  const query = useAggregateFlamegraphQuery({
    // User query is only permitted when using transactions.
    // If this is to be reused for strictly continuous profiling,
    // it'll need to be swapped to use the `profiles` data source
    // with no user query.
    dataSource: 'transactions',
    query: userQuery ?? '',
    metrics: true,
  });

  const sortedMetrics = useMemo(() => {
    return query.data?.metrics?.sort(sortFunctions) ?? [];
  }, [query.data?.metrics]);

  const pagination = useMemoryPagination(sortedMetrics, 5);

  const projectsLookupTable = useMemo(() => {
    return projects.reduce(
      (acc, project) => {
        acc[project.id] = project;
        return acc;
      },
      {} as Record<string, Project>
    );
  }, [projects]);

  const hasFunctions = query.data?.metrics && query.data.metrics.length > 0;

  const columns = [
    {label: '', value: '', width: 62},
    {label: t('Function'), value: 'function'},
    {label: t('Project'), value: 'project'},
    {label: t('Package'), value: 'package'},
    {label: t('p75()'), value: 'p75', width: 'min-content' as const},
    {label: t('p95()'), value: 'p95', width: 'min-content' as const},
    {label: t('p99()'), value: 'p99', width: 'min-content' as const},
  ];

  const {tableStyles} = useTableStyles({items: columns});

  return (
    <Fragment>
      <TableHeader>
        <TableHeaderTitle>{t('Slowest Functions')}</TableHeaderTitle>
        <TableHeaderActions>
          <SlowestFunctionsPaginationContainer>
            <ButtonBar merged>
              <Button
                icon={<IconChevron direction="left" />}
                aria-label={t('Previous')}
                size={'sm'}
                {...pagination.previousButtonProps}
              />
              <Button
                icon={<IconChevron direction="right" />}
                aria-label={t('Next')}
                size={'sm'}
                {...pagination.nextButtonProps}
              />
            </ButtonBar>
          </SlowestFunctionsPaginationContainer>
        </TableHeaderActions>
      </TableHeader>
      <Table style={tableStyles}>
        <TableHead>
          <TableRow>
            {columns.map((column, i) => (
              <TableHeadCell key={column.value} isFirst={i === 0}>
                {column.label}
              </TableHeadCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {query.isPending && (
            <TableStatus>
              <LoadingIndicator size={36} />
            </TableStatus>
          )}
          {query.isError && (
            <TableStatus>
              <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
            </TableStatus>
          )}
          {!query.isError && !query.isPending && !hasFunctions && (
            <TableStatus>
              <EmptyStateWarning>
                <p>{t('No functions found')}</p>
              </EmptyStateWarning>
            </TableStatus>
          )}
          {hasFunctions &&
            query.isFetched &&
            sortedMetrics.slice(pagination.start, pagination.end).map((f, i) => {
              return (
                <SlowestFunction
                  key={i}
                  function={f}
                  projectsLookupTable={projectsLookupTable}
                />
              );
            })}
        </TableBody>
      </Table>
    </Fragment>
  );
}

interface SlowestFunctionProps {
  function: NonNullable<Profiling.Schema['metrics']>[0];
  projectsLookupTable: Record<string, Project>;
}

function SlowestFunction(props: SlowestFunctionProps) {
  const [expanded, setExpanded] = useState(false);
  const organization = useOrganization();

  const exampleLink = makeProfileLinkFromExample(
    organization,
    props.function,
    props.function.examples[0],
    props.projectsLookupTable
  );

  return (
    <Fragment>
      <TableRow>
        <TableBodyCell>
          <div>
            <Button
              icon={<IconChevron direction={expanded ? 'up' : 'down'} />}
              aria-label={t('View Function Metrics')}
              onClick={() => setExpanded(!expanded)}
              size="xs"
              borderless
            />
          </div>
        </TableBodyCell>
        <TableBodyCell>
          <Tooltip title={props.function.name}>
            {exampleLink ? (
              <Link to={exampleLink}>
                {props.function.name || t('<unknown function>')}
              </Link>
            ) : (
              props.function.name || t('<unknown function>')
            )}
          </Tooltip>
        </TableBodyCell>
        <TableBodyCell>
          <SlowestFunctionsProjectBadge
            examples={props.function.examples}
            projectsLookupTable={props.projectsLookupTable}
          />{' '}
        </TableBodyCell>
        <TableBodyCell>
          <Tooltip title={props.function.package || t('<unknown package>')}>
            {props.function.package}
          </Tooltip>
        </TableBodyCell>
        <TableBodyCell>{getPerformanceDuration(props.function.p75 / 1e6)}</TableBodyCell>
        <TableBodyCell>{getPerformanceDuration(props.function.p95 / 1e6)}</TableBodyCell>
        <TableBodyCell>{getPerformanceDuration(props.function.p99 / 1e6)}</TableBodyCell>
      </TableRow>
      {expanded ? (
        <SlowestFunctionTimeSeries
          function={props.function}
          projectsLookupTable={props.projectsLookupTable}
        />
      ) : null}
    </Fragment>
  );
}

interface SlowestFunctionsProjectBadgeProps {
  examples: Profiling.FunctionMetric['examples'];
  projectsLookupTable: Record<string, Project>;
}

function SlowestFunctionsProjectBadge(props: SlowestFunctionsProjectBadgeProps) {
  const resolvedProjects = useMemo(() => {
    const projects: Project[] = [];

    for (const example of props.examples) {
      if ('project_id' in example) {
        const project = props.projectsLookupTable[example.project_id];
        if (project) projects.push(project);
      }
    }

    return projects;
  }, [props.examples, props.projectsLookupTable]);

  return resolvedProjects[0] ? (
    <ProjectBadge avatarSize={16} project={resolvedProjects[0]} />
  ) : null;
}

const METRICS_CHART_OPTIONS: Partial<LineChartProps> = {
  tooltip: {
    valueFormatter: (value: number) => tooltipFormatter(value, 'number'),
  },
  xAxis: {
    show: true,
    type: 'time' as const,
  },
  yAxis: {
    axisLabel: {
      formatter(value: number) {
        return axisLabelFormatter(value, 'integer');
      },
    },
  },
};

interface SlowestFunctionTimeSeriesProps {
  function: Profiling.FunctionMetric;
  projectsLookupTable: Record<string, Project>;
}

function SlowestFunctionTimeSeries(props: SlowestFunctionTimeSeriesProps) {
  const organization = useOrganization();
  const projects = useMemo(() => {
    const projectsMap = props.function.examples.reduce<Record<string, number>>(
      (acc, f) => {
        if (typeof f !== 'string' && 'project_id' in f) {
          acc[f.project_id] = f.project_id;
        }
        return acc;
      },
      {}
    );

    return Object.values(projectsMap);
  }, [props.function]);

  const metrics = useProfilingFunctionMetrics({
    fingerprint: props.function.fingerprint,
    projects,
  });

  const series: Series[] = useMemo(() => {
    if (!metrics.isFetched) return [];

    const serie: Series = {
      seriesName: props.function.name,
      data:
        metrics.data?.data?.map?.(entry => {
          return {
            name: entry[0] * 1000,
            value: entry[1][0].count,
          };
        }) ?? [],
    };

    return [serie];
  }, [metrics, props.function]);

  const examples = useMemo(() => {
    const uniqueExamples: Profiling.FunctionMetric['examples'] = [];

    const profileIds = new Set<string>();
    const transactionIds = new Set<string>();

    for (const example of props.function.examples) {
      if ('profile_id' in example) {
        if (!profileIds.has(example.profile_id)) {
          profileIds.add(example.profile_id);
          uniqueExamples.push(example);
        }
      } else {
        if (
          defined(example.transaction_id) &&
          !transactionIds.has(example.transaction_id)
        ) {
          transactionIds.add(example.transaction_id);
          uniqueExamples.push(example);
        }
      }
    }

    return uniqueExamples;
  }, [props.function.examples]);

  return (
    <TableRow>
      <SlowestFunctionsTimeSeriesContainer>
        <SlowestFunctionsHeader>
          <SlowestFunctionsHeaderCell />
          <SlowestFunctionsHeaderCell>{t('Examples')}</SlowestFunctionsHeaderCell>
          <SlowestFunctionsHeaderCell>{t('Occurrences')}</SlowestFunctionsHeaderCell>
        </SlowestFunctionsHeader>
        <SlowestFunctionsExamplesContainer>
          {examples.slice(0, 5).map((example, i) => {
            const exampleLink = makeProfileLinkFromExample(
              organization,
              props.function,
              example,
              props.projectsLookupTable
            );

            const eventId =
              'profile_id' in example ? example.profile_id : example.transaction_id;

            return (
              <SlowestFunctionsExamplesContainerRow key={i}>
                <SlowestFunctionsExamplesContainerRowInner>
                  {defined(exampleLink) && defined(eventId) && (
                    <Link to={exampleLink}>{getShortEventId(eventId)}</Link>
                  )}
                </SlowestFunctionsExamplesContainerRowInner>
              </SlowestFunctionsExamplesContainerRow>
            );
          })}
        </SlowestFunctionsExamplesContainer>
        <SlowestFunctionsChartContainer>
          {metrics.isPending && (
            <TableStatusContainer>
              <LoadingIndicator size={36} />
            </TableStatusContainer>
          )}
          {metrics.isError && (
            <TableStatusContainer>
              <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
            </TableStatusContainer>
          )}
          {!metrics.isError && !metrics.isPending && !series.length && (
            <TableStatusContainer>
              <EmptyStateWarning>
                <p>{t('No function metrics found')}</p>
              </EmptyStateWarning>
            </TableStatusContainer>
          )}
          {metrics.isFetched && series.length > 0 ? (
            <LineChart
              {...METRICS_CHART_OPTIONS}
              isGroupedByDate
              showTimeInTooltip
              series={series}
            />
          ) : null}
        </SlowestFunctionsChartContainer>
        <SlowestFunctionsRowSpacer>
          <SlowestFunctionsRowSpacerCell />
          <SlowestFunctionsRowSpacerCell />
        </SlowestFunctionsRowSpacer>
      </SlowestFunctionsTimeSeriesContainer>
    </TableRow>
  );
}

const TableStatusContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  height: 100px;
  grid-column: 1 / -1;
`;

const SlowestFunctionsHeader = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;

  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  text-align: left;

  > div:nth-child(n + 4) {
    text-align: right;
  }
`;

const SlowestFunctionsHeaderCell = styled('div')`
  padding: ${space(1)} ${space(2)};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:last-child {
    grid-column: 3 / -1;
  }
`;

const SlowestFunctionsRowSpacer = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  background-color: ${p => p.theme.backgroundSecondary};
  border-top: 1px solid ${p => p.theme.border};
`;

const SlowestFunctionsRowSpacerCell = styled('div')`
  height: ${space(2)};
`;

const SlowestFunctionsTimeSeriesContainer = styled(TableBodyCell)`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  border-top: 1px solid ${p => p.theme.border};

  padding: 0 !important;
`;

const SlowestFunctionsChartContainer = styled('div')`
  grid-column: 3 / -1;
  padding: ${space(3)} ${space(2)} ${space(1)} ${space(2)};
  height: 214px;
`;

const SlowestFunctionsExamplesContainer = styled('div')`
  grid-column: 1 / 3;
  border-right: 1px solid ${p => p.theme.border};

  display: grid;
  grid-template-columns: subgrid;
`;

const SlowestFunctionsExamplesContainerRowInner = styled('div')`
  grid-column: 2 / 3;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const SlowestFunctionsExamplesContainerRow = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / 3;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const SlowestFunctionsPaginationContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;
