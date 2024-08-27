import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import clamp from 'lodash/clamp';
import moment from 'moment-timezone';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {LineChart, type LineChartProps} from 'sentry/components/charts/lineChart';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconProfiling, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useProfilingFunctionMetrics} from 'sentry/utils/profiling/hooks/useProfilingFunctionMetrics';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

import {ContentContainer} from './styles';

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

export function SlowestFunctionsTable() {
  const {projects} = useProjects();
  const query = useAggregateFlamegraphQuery({
    dataSource: 'profiles',
    metrics: true,
  });

  const sortedMetrics = useMemo(() => {
    return query.data?.metrics?.sort(sortFunctions) ?? [];
  }, [query.data?.metrics]);

  const pagination = useMemoryPagination(sortedMetrics, 5);
  const [expandedFingerprint, setExpandedFingerprint] = useState<
    Profiling.FunctionMetric['fingerprint'] | null
  >(null);

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

  return (
    <Fragment>
      <SlowestWidgetContainer>
        <ContentContainer>
          <Fragment>
            <SlowestFunctionsContainer>
              <SlowestFunctionHeader>
                <SlowestFunctionCell>{t('Slowest functions')}</SlowestFunctionCell>
                <SlowestFunctionCell>{t('Package')}</SlowestFunctionCell>
                <SlowestFunctionCell>{t('Project')}</SlowestFunctionCell>
                <SlowestFunctionCell>{t('Count()')}</SlowestFunctionCell>
                <SlowestFunctionCell>{t('p75()')}</SlowestFunctionCell>
                <SlowestFunctionCell>{t('p95()')}</SlowestFunctionCell>
                <SlowestFunctionCell>{t('p99()')}</SlowestFunctionCell>
                <SlowestFunctionCell />
              </SlowestFunctionHeader>
              {query.isLoading && (
                <TableStatusContainer>
                  <LoadingIndicator size={36} />
                </TableStatusContainer>
              )}
              {query.isError && (
                <TableStatusContainer>
                  <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
                </TableStatusContainer>
              )}
              {!query.isError && !query.isLoading && !hasFunctions && (
                <TableStatusContainer>
                  <EmptyStateWarning>
                    <p>{t('No functions found')}</p>
                  </EmptyStateWarning>
                </TableStatusContainer>
              )}
              {hasFunctions &&
                query.isFetched &&
                sortedMetrics.slice(pagination.start, pagination.end).map((f, i) => {
                  return (
                    <SlowestFunction
                      key={i}
                      function={f}
                      projectsLookupTable={projectsLookupTable}
                      expanded={f.fingerprint === expandedFingerprint}
                      onExpandClick={setExpandedFingerprint}
                    />
                  );
                })}
            </SlowestFunctionsContainer>
          </Fragment>
        </ContentContainer>
      </SlowestWidgetContainer>
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
    </Fragment>
  );
}

interface SlowestFunctionProps {
  expanded: boolean;
  function: NonNullable<Profiling.Schema['metrics']>[0];
  onExpandClick: React.Dispatch<
    React.SetStateAction<Profiling.FunctionMetric['fingerprint'] | null>
  >;
  projectsLookupTable: Record<string, Project>;
}

function SlowestFunction(props: SlowestFunctionProps) {
  const organization = useOrganization();

  const exampleLink = makeProfileLinkFromExample(
    organization,
    props.function,
    props.function.examples[0],
    props.projectsLookupTable
  );

  return (
    <SlowestFunctionContainer>
      <SlowestFunctionCell>
        <Tooltip title={props.function.name}>
          {exampleLink ? (
            <Link to={exampleLink}>{props.function.name || t('<unknown function>')}</Link>
          ) : (
            props.function.name || t('<unknown function>')
          )}
        </Tooltip>
      </SlowestFunctionCell>
      <SlowestFunctionCell>
        <Tooltip title={props.function.package || t('<unknown package>')}>
          {props.function.package}
        </Tooltip>
      </SlowestFunctionCell>
      <SlowestFunctionCell>
        <SlowestFunctionsProjectBadge
          examples={props.function.examples}
          projectsLookupTable={props.projectsLookupTable}
        />{' '}
      </SlowestFunctionCell>
      <SlowestFunctionCell>
        {formatAbbreviatedNumber(props.function.count)}
      </SlowestFunctionCell>
      <SlowestFunctionCell>
        {getPerformanceDuration(props.function.p75 / 1e6)}
      </SlowestFunctionCell>
      <SlowestFunctionCell>
        {getPerformanceDuration(props.function.p95 / 1e6)}
      </SlowestFunctionCell>
      <SlowestFunctionCell>
        {getPerformanceDuration(props.function.p99 / 1e6)}
      </SlowestFunctionCell>
      <SlowestFunctionCell>
        <Button
          icon={<IconChevron direction={props.expanded ? 'up' : 'down'} />}
          aria-label={t('View Function Metrics')}
          onClick={() =>
            props.onExpandClick(props.expanded ? null : props.function.fingerprint)
          }
          size="xs"
        />
      </SlowestFunctionCell>
      {props.expanded ? (
        <SlowestFunctionTimeSeries
          function={props.function}
          projectsLookupTable={props.projectsLookupTable}
        />
      ) : null}
    </SlowestFunctionContainer>
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
    valueFormatter: (value: number) => {
      return formatAbbreviatedNumber(value);
    },
    formatAxisLabel: (value: number) => {
      return moment(value * 1e3).format('YYYY-MM-DDTHH:mm:ss.SSS');
    },
  },
  xAxis: {
    show: true,
    type: 'time',
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
            name: entry[0],
            value: entry[1][0].count,
          };
        }) ?? [],
    };

    return [serie];
  }, [metrics, props.function]);

  return (
    <SlowestFunctionsTimeSeriesContainer>
      <SlowestFunctionsHeader>
        <SlowestFunctionsHeaderCell>{t('Examples')}</SlowestFunctionsHeaderCell>
        <SlowestFunctionsHeaderCell>{t('Occurrences')}</SlowestFunctionsHeaderCell>
      </SlowestFunctionsHeader>
      <SlowestFunctionsExamplesContainer>
        {props.function.examples.slice(0, 5).map((example, i) => {
          const exampleLink = makeProfileLinkFromExample(
            organization,
            props.function,
            example,
            props.projectsLookupTable
          );
          return (
            <SlowestFunctionsExamplesContainerRow key={i}>
              <SlowestFunctionsExamplesContainerRowInner>
                {'project_id' in example ? (
                  <SlowestFunctionsProjectBadge
                    examples={[example]}
                    projectsLookupTable={props.projectsLookupTable}
                  />
                ) : null}
                {exampleLink && (
                  <LinkButton
                    icon={<IconProfiling />}
                    to={exampleLink}
                    aria-label={t('Profile')}
                    size="xs"
                  />
                )}
              </SlowestFunctionsExamplesContainerRowInner>
            </SlowestFunctionsExamplesContainerRow>
          );
        })}
      </SlowestFunctionsExamplesContainer>
      <SlowestFunctionsChartContainer>
        {metrics.isLoading && (
          <TableStatusContainer>
            <LoadingIndicator size={36} />
          </TableStatusContainer>
        )}
        {metrics.isError && (
          <TableStatusContainer>
            <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
          </TableStatusContainer>
        )}
        {!metrics.isError && !metrics.isLoading && !series.length && (
          <TableStatusContainer>
            <EmptyStateWarning>
              <p>{t('No function metrics found')}</p>
            </EmptyStateWarning>
          </TableStatusContainer>
        )}
        {metrics.isFetched && series.length > 0 ? (
          <LineChart {...METRICS_CHART_OPTIONS} series={series} />
        ) : null}
      </SlowestFunctionsChartContainer>
      <SlowestFunctionsRowSpacer>
        <SlowestFunctionsRowSpacerCell />
        <SlowestFunctionsRowSpacerCell />
      </SlowestFunctionsRowSpacer>
    </SlowestFunctionsTimeSeriesContainer>
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

  &:first-child {
    grid-column: 1 / 3;
  }
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

const SlowestFunctionsTimeSeriesContainer = styled('div')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  border-top: 1px solid ${p => p.theme.border};
`;

const SlowestFunctionsChartContainer = styled('div')`
  grid-column: 3/-1;
  padding: ${space(3)} ${space(2)} ${space(1)} ${space(2)};
  height: 214px;
`;

const SlowestFunctionsExamplesContainer = styled('div')`
  grid-column: 1/3;
  border-right: 1px solid ${p => p.theme.border};
`;

const SlowestFunctionsExamplesContainerRowInner = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const SlowestFunctionsExamplesContainerRow = styled('div')`
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const SlowestFunctionsPaginationContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${space(2)};
`;

const SlowestWidgetContainer = styled(Panel)`
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SlowestFunctionHeader = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;

  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;

  > div:nth-child(n + 4) {
    text-align: right;
  }
`;

const SlowestFunctionsContainer = styled('div')`
  display: grid;
  grid-template-columns:
    minmax(90px, auto) minmax(90px, auto) minmax(40px, 140px) min-content min-content
    min-content min-content min-content min-content;
  border-collapse: collapse;
`;

const SlowestFunctionCell = styled('div')`
  padding: ${space(1)} ${space(2)};
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const SlowestFunctionContainer = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  font-size: ${p => p.theme.fontSizeSmall};

  border-bottom: 1px solid ${p => p.theme.border};
  &:last-child {
    border-bottom: 0;
  }

  > div:nth-child(n + 4) {
    text-align: right;
  }
`;
