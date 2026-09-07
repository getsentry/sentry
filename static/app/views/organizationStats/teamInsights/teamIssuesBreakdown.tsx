import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {BarChartSeries} from 'sentry/components/charts/barChart';
import {BarChart} from 'sentry/components/charts/barChart';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import {COLLAPSE_COUNT, CollapsePanel} from 'sentry/components/collapsePanel';
import {LoadingError} from 'sentry/components/loadingError';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';

import {ProjectBadge, ProjectBadgeContainer, TeamInsightsTable} from './styles';
import {barAxisLabel, convertDayValueObjectToSeries, sortSeriesByDay} from './utils';

interface StatusCounts {
  total: number;
  archived_forever?: number;
  archived_until_condition_met?: number;
  archived_until_escalating?: number;
  deleted?: number;
  escalating?: number;
  ignored?: number;
  new?: number;
  regressed?: number;
  resolved?: number;
  unarchived?: number;
  unignored?: number;
}

export type IssuesBreakdown = Record<string, Record<string, StatusCounts>>;

type Statuses = keyof Omit<StatusCounts, 'total'>;

interface TeamIssuesBreakdownProps extends DateTimeObject {
  organization: Organization;
  projects: Project[];
  statuses: Statuses[];
  teamSlug: string;
  environment?: string;
}

const keys = [
  'deleted',
  'ignored',
  'resolved',
  'unignored',
  'regressed',
  'new',
  'total',
  'escalating',
  'archived_until_escalating',
  'archived_forever',
  'archived_until_condition_met',
];

export function TeamIssuesBreakdown({
  organization,
  projects,
  start,
  end,
  period,
  utc,
  teamSlug,
  statuses,
  environment,
}: TeamIssuesBreakdownProps) {
  const {
    data: issuesBreakdown = {},
    isPending,
    isError,
    refetch,
  } = useApiQuery<IssuesBreakdown>(
    [
      getApiUrl('/teams/$organizationIdOrSlug/$teamIdOrSlug/issue-breakdown/', {
        path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: teamSlug},
      }),
      {
        query: {
          ...normalizeDateTimeParams({start, end, period, utc}),
          statuses,
          environment,
        },
      },
    ],
    {staleTime: 5000}
  );

  const allReviewedByDay: Record<string, Record<string, number>> = {};
  // Total statuses & total reviewed keyed by project ID
  const projectTotals: Record<string, StatusCounts> = {};

  // The issues breakdown is keyed by projectId
  for (const [projectId, entries] of Object.entries(issuesBreakdown)) {
    // Each bucket is 1 day
    for (const [bucket, counts] of Object.entries(entries)) {
      if (!projectTotals[projectId]) {
        projectTotals[projectId] = {
          deleted: 0,
          escalating: 0,
          ignored: 0,
          resolved: 0,
          unignored: 0,
          regressed: 0,
          archived_until_escalating: 0,
          archived_forever: 0,
          archived_until_condition_met: 0,
          new: 0,
          total: 0,
        };
      }

      for (const key of keys) {
        projectTotals[projectId][key as keyof StatusCounts] +=
          counts[key as keyof StatusCounts]!;
      }

      if (!allReviewedByDay[projectId]) {
        allReviewedByDay[projectId] = {};
      }

      if (allReviewedByDay[projectId][bucket] === undefined) {
        allReviewedByDay[projectId][bucket] = counts.total;
      } else {
        allReviewedByDay[projectId][bucket] += counts.total;
      }
    }
  }

  const sortedProjectIds = Object.entries(projectTotals)
    .map(([projectId, {total}]) => ({projectId, total}))
    .sort((a, b) => b.total - a.total);

  // There are projects with more than 0 results
  const hasResults = sortedProjectIds.some(({total}) => total !== 0);
  const allSeries = Object.keys(allReviewedByDay)
    // Hide projects with no results when there are other projects with results
    .filter(projectId => (hasResults ? projectTotals[projectId]!.total !== 0 : true))
    .map((projectId, idx): BarChartSeries => ({
      seriesName: ProjectsStore.getById(projectId)?.slug ?? projectId,
      data: sortSeriesByDay(convertDayValueObjectToSeries(allReviewedByDay[projectId]!)),
      animationDuration: 500,
      animationDelay: idx * 500,
      silent: true,
      barCategoryGap: '5%',
    }));

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <Fragment>
      <IssuesChartWrapper>
        {isPending && <Placeholder height="200px" />}
        {!isPending && (
          <BarChart
            style={{height: 200}}
            stacked
            isGroupedByDate
            useShortDate
            legend={{right: 0, top: 0}}
            xAxis={barAxisLabel()}
            yAxis={{minInterval: 1}}
            series={allSeries}
          />
        )}
      </IssuesChartWrapper>
      <CollapsePanel items={sortedProjectIds.length}>
        {({isExpanded, showMoreButton}) => (
          <Fragment>
            <StyledSimpleTable
              numActions={statuses.length}
              header={
                <SimpleTable.HeaderRow>
                  <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
                  {statuses
                    .map(action => action.replace('ignore', 'archive'))
                    .map(action => (
                      <SimpleTable.HeaderCell key={action}>
                        <AlignRight>{action}</AlignRight>
                      </SimpleTable.HeaderCell>
                    ))}
                  <SimpleTable.HeaderCell>
                    <AlignRight>
                      {t('total')}{' '}
                      <IconArrow direction="down" size="xs" variant="muted" />
                    </AlignRight>
                  </SimpleTable.HeaderCell>
                </SimpleTable.HeaderRow>
              }
            >
              {isPending && <SimpleTable.Loading />}
              {!isPending &&
                sortedProjectIds.map(({projectId}, idx) => {
                  const project = projects.find(p => p.id === projectId);

                  if (idx >= COLLAPSE_COUNT && !isExpanded) {
                    return null;
                  }

                  return (
                    <SimpleTable.Row key={projectId}>
                      <SimpleTable.RowCell>
                        <ProjectBadgeContainer>
                          {project && <ProjectBadge avatarSize={18} project={project} />}
                        </ProjectBadgeContainer>
                      </SimpleTable.RowCell>
                      {statuses.map(action => (
                        <SimpleTable.RowCell key={action} justify="end">
                          {projectTotals[projectId]![action]}
                        </SimpleTable.RowCell>
                      ))}
                      <SimpleTable.RowCell justify="end">
                        {projectTotals[projectId]!.total}
                      </SimpleTable.RowCell>
                    </SimpleTable.Row>
                  );
                })}
            </StyledSimpleTable>
            {!isPending && showMoreButton}
          </Fragment>
        )}
      </CollapsePanel>
    </Fragment>
  );
}

const ChartWrapper = styled('div')`
  padding: ${p => p.theme.space.xl} ${p => p.theme.space.xl} 0 ${p => p.theme.space.xl};
`;

const IssuesChartWrapper = styled(ChartWrapper)`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const StyledSimpleTable = styled(TeamInsightsTable, {
  shouldForwardProp: prop => prop !== 'numActions',
})<{numActions: number}>`
  grid-template-columns: 1fr ${p => ' 0.2fr'.repeat(p.numActions)} 0.2fr;
`;

const AlignRight = styled('div')`
  text-align: right;
  font-variant-numeric: tabular-nums;
`;
