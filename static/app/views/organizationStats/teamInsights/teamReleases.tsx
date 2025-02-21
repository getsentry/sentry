import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import round from 'lodash/round';
import moment from 'moment-timezone';

import {LinkButton} from 'sentry/components/button';
import {BarChart} from 'sentry/components/charts/barChart';
import MarkLine from 'sentry/components/charts/components/markLine';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PanelTable} from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import toArray from 'sentry/utils/array/toArray';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';

import {ProjectBadge, ProjectBadgeContainer} from './styles';
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

function TeamReleases({
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
      `/teams/${organization.slug}/${teamSlug}/release-count/`,
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
      `/teams/${organization.slug}/${teamSlug}/release-count/`,
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
      <SubText color={trend >= 0 ? 'successText' : 'errorText'}>
        {`${round(Math.abs(trend), 3)}`}
        <PaddedIconArrow direction={trend >= 0 ? 'up' : 'down'} size="xs" />
      </SubText>
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
              markLine: MarkLine({
                silent: true,
                lineStyle: {color: theme.gray200, type: 'dashed', width: 1},
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
      <StyledPanelTable
        isEmpty={projects.length === 0}
        emptyMessage={t('No releases were setup for this team’s projects')}
        emptyAction={
          <LinkButton
            size="sm"
            external
            href="https://docs.sentry.io/product/releases/setup/"
          >
            {t('Learn More')}
          </LinkButton>
        }
        headers={[
          t('Releases Per Project'),
          <RightAligned key="last">
            {tct('Last [period] Average', {period})}
          </RightAligned>,
          <RightAligned key="curr">{t('Last 7 Days')}</RightAligned>,
          <RightAligned key="diff">{t('Difference')}</RightAligned>,
        ]}
      >
        {groupedProjects.map(({project}) => (
          <Fragment key={project.id}>
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

            <ScoreWrapper>{renderReleaseCount(project.id, 'period')}</ScoreWrapper>
            <ScoreWrapper>
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
            </ScoreWrapper>
            <ScoreWrapper>{renderTrend(project.id)}</ScoreWrapper>
          </Fragment>
        ))}
      </StyledPanelTable>
    </div>
  );
}

export default TeamReleases;

const ChartWrapper = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledPanelTable = styled(PanelTable)<{isEmpty: boolean}>`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.2fr;
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: unset;

  & > div {
    padding: ${space(1)} ${space(2)};
  }

  ${p =>
    p.isEmpty &&
    css`
      & > div:last-child {
        padding: 48px ${space(2)};
      }
    `}
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
