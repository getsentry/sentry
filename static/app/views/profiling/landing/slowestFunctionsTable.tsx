import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {clamp} from 'lodash';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useProfilingFunctionMetrics} from 'sentry/utils/profiling/hooks/useProfilingFunctionMetrics';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

import {ContentContainer, StatusContainer} from './styles';

function sortFunctions(a: Profiling.FunctionMetric, b: Profiling.FunctionMetric) {
  return b.sum - a.sum;
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
          {query.isLoading && (
            <StatusContainer>
              <LoadingIndicator size={36} />
            </StatusContainer>
          )}
          {query.isError && (
            <StatusContainer>
              <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
            </StatusContainer>
          )}
          {!query.isError && !query.isLoading && !hasFunctions && (
            <EmptyStateWarning>
              <p>{t('No functions found')}</p>
            </EmptyStateWarning>
          )}
          {hasFunctions && query.isFetched && (
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
                  {/* @TODO remove sum before relasing */}
                  <SlowestFunctionCell>{t('Sum()')}</SlowestFunctionCell>
                  <SlowestFunctionCell />
                </SlowestFunctionHeader>
                {sortedMetrics.slice(pagination.start, pagination.end).map((f, i) => {
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
          )}
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

  const example = props.function.examples[0];
  const exampleLink =
    example && typeof example !== 'string' && 'project_id' in example
      ? generateProfileRouteFromProfileReference({
          frameName: props.function.name,
          framePackage: props.function.package,
          orgSlug: organization.slug,
          projectSlug: props.projectsLookupTable[example.project_id]?.slug ?? '',
          reference: props.function.examples[0],
        })
      : null;

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
        {/* @TODO remove sum before relasing */}
        {getPerformanceDuration(props.function.sum / 1e6)}
      </SlowestFunctionCell>
      <SlowestFunctionCell>
        <Button
          icon={<IconChevron direction={props.expanded ? 'up' : 'down'} />}
          aria-label={t('View Function Metrics')}
          onClick={() => props.onExpandClick(props.function.fingerprint)}
          size="xs"
        />
      </SlowestFunctionCell>
      {props.expanded ? <SlowestFunctionTimeSeries function={props.function} /> : null}
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
      if (typeof example !== 'string' && 'project_id' in example) {
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

interface SlowestFunctionTimeSeriesProps {
  function: Profiling.FunctionMetric;
}

function SlowestFunctionTimeSeries(props: SlowestFunctionTimeSeriesProps) {
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

  useProfilingFunctionMetrics({
    fingerprint: props.function.fingerprint,
    projects,
  });

  // @TODO add chart
  return null;
}

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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
