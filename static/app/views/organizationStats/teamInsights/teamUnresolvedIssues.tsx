import {Fragment} from 'react';
import styled from '@emotion/styled';

import {BarChart} from 'sentry/components/charts/barChart';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import CollapsePanel, {COLLAPSE_COUNT} from 'sentry/components/collapsePanel';
import LoadingError from 'sentry/components/loadingError';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PanelTable} from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {ColorOrAlias} from 'sentry/utils/theme';

import {ProjectBadge, ProjectBadgeContainer} from './styles';
import {
  barAxisLabel,
  convertDayValueObjectToSeries,
  groupByTrend,
  sortSeriesByDay,
} from './utils';

interface TeamUnresolvedIssuesProps extends DateTimeObject {
  organization: Organization;
  projects: Project[];
  teamSlug: string;
  environment?: string;
}

type UnresolvedCount = {unresolved: number};
type ProjectReleaseCount = Record<string, Record<string, UnresolvedCount>>;

export function TeamUnresolvedIssues({
  organization,
  teamSlug,
  projects,
  start,
  end,
  period,
  utc,
  environment,
}: TeamUnresolvedIssuesProps) {
  const {
    data: periodIssues = {},
    isPending,
    isError,
    refetch,
  } = useApiQuery<ProjectReleaseCount>(
    [
      `/teams/${organization.slug}/${teamSlug}/all-unresolved-issues/`,
      {
        query: {
          ...normalizeDateTimeParams({start, end, period, utc}),
          environment,
        },
      },
    ],
    {staleTime: 0}
  );

  function getTotalUnresolved(projectId: number): number {
    const entries = Object.values(periodIssues?.[projectId] ?? {});
    const total = entries.reduce((acc, current) => acc + current.unresolved, 0);
    if (total === 0) {
      return 0;
    }

    return Math.round(total / entries.length);
  }

  const projectTotals: Record<
    string,
    {percentChange: number; periodAvg: number; projectId: string; today: number}
  > = {};
  for (const projectId of Object.keys(periodIssues)) {
    const periodAvg = getTotalUnresolved(Number(projectId));
    const projectPeriodEntries = Object.entries(periodIssues?.[projectId] ?? {}).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
    const today = projectPeriodEntries[0]?.[1]?.unresolved ?? 0;
    const percentChange = (today - periodAvg) / periodAvg;
    projectTotals[projectId] = {
      projectId,
      periodAvg,
      today,
      percentChange: Number.isNaN(percentChange) ? 0 : percentChange,
    };
  }

  const sortedProjects = projects
    .map(project => ({project, trend: projectTotals[project.id]?.percentChange ?? 0}))
    .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));

  const groupedProjects = groupByTrend(sortedProjects);

  // All data will contain all pairs of [day, unresolved_count].
  const allData = Object.values(periodIssues).flatMap(data =>
    Object.entries(data).map(
      ([bucket, {unresolved}]) => [bucket, unresolved] as [string, number]
    )
  );
  // Total by day for all projects
  const totalByDay = allData.reduce((acc, [bucket, unresolved]) => {
    if (acc[bucket] === undefined) {
      acc[bucket] = 0;
    }
    acc[bucket] += unresolved;
    return acc;
  }, {});

  const seriesData = sortSeriesByDay(convertDayValueObjectToSeries(totalByDay));

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <div>
      <ChartWrapper>
        {isPending && <Placeholder height="200px" />}
        {!isPending && (
          <BarChart
            style={{height: 190}}
            isGroupedByDate
            useShortDate
            legend={{right: 3, top: 0}}
            yAxis={{minInterval: 1}}
            xAxis={barAxisLabel()}
            series={[
              {
                seriesName: t('Unresolved Issues'),
                silent: true,
                data: seriesData,
                barCategoryGap: '6%',
              },
            ]}
          />
        )}
      </ChartWrapper>
      <CollapsePanel items={groupedProjects.length}>
        {({isExpanded, showMoreButton}) => (
          <Fragment>
            <StyledPanelTable
              isEmpty={projects.length === 0}
              isLoading={isPending}
              headers={[
                t('Project'),
                <RightAligned key="last">
                  {tct('Last [period] Average', {period})}
                </RightAligned>,
                <RightAligned key="curr">{t('Today')}</RightAligned>,
                <RightAligned key="diff">{t('Change')}</RightAligned>,
              ]}
            >
              {groupedProjects.map(({project}, idx) => {
                const totals = projectTotals[project.id] ?? {
                  percentChange: 0,
                  periodAvg: undefined,
                  projectId: undefined,
                  today: undefined,
                };

                if (idx >= COLLAPSE_COUNT && !isExpanded) {
                  return null;
                }

                return (
                  <Fragment key={project.id}>
                    <ProjectBadgeContainer>
                      <ProjectBadge avatarSize={18} project={project} />
                    </ProjectBadgeContainer>

                    <ScoreWrapper>{totals?.periodAvg}</ScoreWrapper>
                    <ScoreWrapper>{totals?.today}</ScoreWrapper>
                    <ScoreWrapper>
                      <SubText
                        color={
                          totals.percentChange === 0
                            ? 'subText'
                            : totals.percentChange > 0
                              ? 'errorText'
                              : 'successText'
                        }
                      >
                        {formatPercentage(
                          Number.isNaN(totals.percentChange) ? 0 : totals.percentChange,
                          0
                        )}
                        <PaddedIconArrow
                          direction={totals.percentChange > 0 ? 'up' : 'down'}
                          size="xs"
                        />
                      </SubText>
                    </ScoreWrapper>
                  </Fragment>
                );
              })}
            </StyledPanelTable>
            {!isPending && showMoreButton}
          </Fragment>
        )}
      </CollapsePanel>
    </div>
  );
}

const ChartWrapper = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.2fr;
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: unset;

  & > div {
    padding: ${space(1)} ${space(2)};
  }
`;

const RightAligned = styled('span')`
  text-align: right;
`;

const ScoreWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  text-align: right;
`;

const PaddedIconArrow = styled(IconArrow)`
  margin: 0 ${space(0.5)};
`;

const SubText = styled('div')<{color: ColorOrAlias}>`
  color: ${p => p.theme[p.color]};
`;
