import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import round from 'lodash/round';
import moment from 'moment-timezone';

import {LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {BarChart} from 'sentry/components/charts/barChart';
import {markLine} from 'sentry/components/charts/components/markLine';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {toArray} from 'sentry/utils/array/toArray';
import {useApiQuery} from 'sentry/utils/queryClient';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';

import {ProjectBadge, ProjectBadgeContainer, TeamInsightsTable} from './styles';
import {barAxisLabel, groupByTrend, sortSeriesByDay} from './utils';

interface TeamReleasesProps extends DateTimeObject {
  organization: Organization;
  projects: Project[];
  teamSlug: string;
}

export type ProjectReleaseCount = {
  last_week_totals: Record<string, number>;
  project_avgs: Record<string, number>;
  release_counts: Record<string, number>;
};

export function TeamReleases({
  organization,
  projects,
  teamSlug,
  start,
  end,
  period,
  utc,
}: TeamReleasesProps) {
  const theme = useTheme();
  const datetime = {start, end, period, utc};

  const {
    data: periodReleases,
    isPending: isPeriodReleasesLoading,
    isError: isPeriodReleasesError,
    refetch: refetchPeriodReleases,
  } = useApiQuery<ProjectReleaseCount>(
    [
      getApiUrl('/teams/$organizationIdOrSlug/$teamIdOrSlug/release-count/', {
        path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: teamSlug},
      }),
      {
        query: {
          ...normalizeDateTimeParams(datetime),
        },
      },
    ],
    {staleTime: 5000}
  );

  const {
    data: weekReleases,
    isPending: isWeekReleasesLoading,
    isError: isWeekReleasesError,
    refetch: refetchWeekReleases,
  } = useApiQuery<ProjectReleaseCount>(
    [
      getApiUrl('/teams/$organizationIdOrSlug/$teamIdOrSlug/release-count/', {
        path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: teamSlug},
      }),
      {
        query: {
          statsPeriod: '7d',
        },
      },
    ],
    {staleTime: 5000}
  );

  const isLoading = isPeriodReleasesLoading || isWeekReleasesLoading;

  if (isPeriodReleasesError || isWeekReleasesError) {
    return (
      <LoadingError
        onRetry={() => {
          refetchPeriodReleases();
          refetchWeekReleases();
        }}
      />
    );
  }

  function getReleaseCount(projectId: number, dataset: 'week' | 'period'): number | null {
    const releasesPeriod =
      dataset === 'week' ? weekReleases?.last_week_totals : periodReleases?.project_avgs;

    const count = releasesPeriod?.[projectId]
      ? Math.ceil(releasesPeriod?.[projectId])
      : 0;

    return count;
  }

  function getTrend(projectId: number): number | null {
    const periodCount = getReleaseCount(projectId, 'period');
    const weekCount = getReleaseCount(projectId, 'week');

    if (periodCount === null || weekCount === null) {
      return null;
    }

    return weekCount - periodCount;
  }

  function renderReleaseCount(projectId: string, dataset: 'week' | 'period') {
    if (isLoading) {
      return (
        <div>
          <Placeholder width="80px" height="25px" />
        </div>
      );
    }

    const count = getReleaseCount(Number(projectId), dataset);

    if (count === null) {
      return '\u2014';
    }

    return count;
  }

  function renderTrend(projectId: string) {
    if (isLoading) {
      return (
        <div>
          <Placeholder width="80px" height="25px" />
        </div>
      );
    }

    const trend = getTrend(Number(projectId));

    if (trend === null) {
      return '\u2014';
    }

    return (
      <Text variant={trend >= 0 ? 'success' : 'danger'}>
        {`${round(Math.abs(trend), 3)}`}
        <PaddedIconArrow direction={trend >= 0 ? 'up' : 'down'} size="xs" />
      </Text>
    );
  }

  const sortedProjects = projects
    .map(project => ({project, trend: getTrend(Number(project.id)) ?? 0}))
    .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));

  const groupedProjects = groupByTrend(sortedProjects);

  const data = Object.entries(periodReleases?.release_counts ?? {}).map(
    ([bucket, count]) => ({
      value: Math.ceil(count),
      name: new Date(bucket).getTime(),
    })
  );
  const seriesData = sortSeriesByDay(data);

  const averageValues = Object.values(periodReleases?.project_avgs ?? {});
  const projectAvgSum = averageValues.reduce(
    (total, currentData) => total + currentData,
    0
  );
  const totalPeriodAverage = Math.ceil(projectAvgSum / averageValues.length);

  return (
    <div>
      <ChartWrapper>
        <BarChart
          style={{height: 190}}
          isGroupedByDate
          useShortDate
          period="7d"
          legend={{right: 3, top: 0}}
          yAxis={{minInterval: 1}}
          xAxis={barAxisLabel()}
          series={[
            {
              seriesName: t('This Period'),
              silent: true,
              data: seriesData,
              markLine: markLine({
                silent: true,
                lineStyle: {color: theme.colors.gray200, type: 'dashed', width: 1},
                data: [{yAxis: totalPeriodAverage}],
                label: {
                  show: false,
                },
              }),
              barCategoryGap: '5%',
            },
          ]}
          tooltip={{
            formatter: (seriesParams: any) => {
              // `seriesParams` can be an array or an object :/
              const [series] = toArray(seriesParams);

              if (!series.data?.value) {
                return '';
              }

              const dateFormat = 'MMM D';
              const startDate = moment(series.data.value[0]).format(dateFormat);
              const endDate = moment(series.data.value[0])
                .add(7, 'days')
                .format(dateFormat);
              return [
                '<div class="tooltip-series">',
                `<div><span class="tooltip-label">${series.marker} <strong>${series.seriesName}</strong></span> ${series.data.value[1]}</div>`,
                `<div><span class="tooltip-label"><strong>Last ${period} Average</strong></span> ${totalPeriodAverage}</div>`,
                '</div>',
                `<div class="tooltip-footer">${startDate} - ${endDate}</div>`,
                '<div class="tooltip-arrow"></div>',
              ].join('');
            },
          }}
        />
      </ChartWrapper>
      <StyledSimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Releases Per Project')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <RightAligned>{tct('Last [period] Average', {period})}</RightAligned>
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <RightAligned>{t('Last 7 Days')}</RightAligned>
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <RightAligned>{t('Difference')}</RightAligned>
            </SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {projects.length === 0 ? (
          <SimpleTable.Empty>
            <EmptyState
              title={t('No releases were setup for this team’s projects')}
              action={
                <LinkButton
                  size="sm"
                  external
                  href="https://docs.sentry.io/product/releases/setup/"
                >
                  {t('Learn More')}
                </LinkButton>
              }
            />
          </SimpleTable.Empty>
        ) : (
          groupedProjects.map(({project}) => (
            <SimpleTable.Row key={project.id}>
              <SimpleTable.RowCell>
                <ProjectBadgeContainer>
                  <ProjectBadge
                    avatarSize={18}
                    project={project}
                    to={{
                      pathname: makeReleasesPathname({
                        organization,
                        path: '/',
                      }),
                      query: {project: project.id},
                    }}
                  />
                </ProjectBadgeContainer>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                {renderReleaseCount(project.id, 'period')}
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Link
                  to={{
                    pathname: makeReleasesPathname({
                      organization,
                      path: '/',
                    }),
                    query: {project: project.id, statsPeriod: '7d'},
                  }}
                >
                  {renderReleaseCount(project.id, 'week')}
                </Link>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                {renderTrend(project.id)}
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          ))
        )}
      </StyledSimpleTable>
    </div>
  );
}

const ChartWrapper = styled('div')`
  padding: ${p => p.theme.space.xl} ${p => p.theme.space.xl} 0 ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const StyledSimpleTable = styled(TeamInsightsTable)`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.2fr;
`;

const RightAligned = styled('span')`
  text-align: right;
`;

const PaddedIconArrow = styled(IconArrow)`
  margin: 0 ${p => p.theme.space.xs};
`;
