import {ComponentType, Fragment} from 'react';
import {css, withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import round from 'lodash/round';
import moment from 'moment';

import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import BarChart from 'sentry/components/charts/barChart';
import MarkLine from 'sentry/components/charts/components/markLine';
import {DateTimeObject} from 'sentry/components/charts/utils';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PanelTable from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {Color, Theme} from 'sentry/utils/theme';

import {ProjectBadge, ProjectBadgeContainer} from './styles';
import {barAxisLabel, groupByTrend, sortSeriesByDay} from './utils';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
  teamSlug: string;
  theme: Theme;
} & DateTimeObject;

type ProjectReleaseCount = {
  last_week_totals: Record<string, number>;
  project_avgs: Record<string, number>;
  release_counts: Record<string, number>;
};

type State = AsyncComponent['state'] & {
  /** weekly selected date range */
  periodReleases: ProjectReleaseCount | null;
  /** Locked to last 7 days */
  weekReleases: ProjectReleaseCount | null;
};

class TeamReleases extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      weekReleases: null,
      periodReleases: null,
    };
  }

  getEndpoints() {
    const {organization, start, end, period, utc, teamSlug} = this.props;

    const datetime = {start, end, period, utc};

    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [
      [
        'periodReleases',
        `/teams/${organization.slug}/${teamSlug}/release-count/`,
        {
          query: {
            ...normalizeDateTimeParams(datetime),
          },
        },
      ],
      [
        'weekReleases',
        `/teams/${organization.slug}/${teamSlug}/release-count/`,
        {
          query: {
            statsPeriod: '7d',
          },
        },
      ],
    ];

    return endpoints;
  }

  componentDidUpdate(prevProps: Props) {
    const {teamSlug, start, end, period, utc} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc ||
      !isEqual(prevProps.teamSlug, teamSlug)
    ) {
      this.remountComponent();
    }
  }

  getReleaseCount(projectId: number, dataset: 'week' | 'period'): number | null {
    const {periodReleases, weekReleases} = this.state;

    const releasesPeriod =
      dataset === 'week' ? weekReleases?.last_week_totals : periodReleases?.project_avgs;

    const count = releasesPeriod?.[projectId]
      ? Math.ceil(releasesPeriod?.[projectId])
      : 0;

    return count;
  }

  getTrend(projectId: number): number | null {
    const periodCount = this.getReleaseCount(projectId, 'period');
    const weekCount = this.getReleaseCount(projectId, 'week');

    if (periodCount === null || weekCount === null) {
      return null;
    }

    return weekCount - periodCount;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderReleaseCount(projectId: string, dataset: 'week' | 'period') {
    const {loading} = this.state;

    if (loading) {
      return (
        <div>
          <Placeholder width="80px" height="25px" />
        </div>
      );
    }

    const count = this.getReleaseCount(Number(projectId), dataset);

    if (count === null) {
      return '\u2014';
    }

    return count;
  }

  renderTrend(projectId: string) {
    const {loading} = this.state;

    if (loading) {
      return (
        <div>
          <Placeholder width="80px" height="25px" />
        </div>
      );
    }

    const trend = this.getTrend(Number(projectId));

    if (trend === null) {
      return '\u2014';
    }

    return (
      <SubText color={trend >= 0 ? 'green300' : 'red300'}>
        {`${round(Math.abs(trend), 3)}`}
        <PaddedIconArrow direction={trend >= 0 ? 'up' : 'down'} size="xs" />
      </SubText>
    );
  }

  renderBody() {
    const {projects, period, theme, organization} = this.props;
    const {periodReleases} = this.state;

    const sortedProjects = projects
      .map(project => ({project, trend: this.getTrend(Number(project.id)) ?? 0}))
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
            xAxis={barAxisLabel(seriesData.length)}
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
              formatter: seriesParams => {
                // `seriesParams` can be an array or an object :/
                const [series] = Array.isArray(seriesParams)
                  ? seriesParams
                  : [seriesParams];

                const dateFormat = 'MMM D';
                const startDate = moment(series.data[0]).format(dateFormat);
                const endDate = moment(series.data[0]).add(7, 'days').format(dateFormat);
                return [
                  '<div class="tooltip-series">',
                  `<div><span class="tooltip-label">${series.marker} <strong>${series.seriesName}</strong></span> ${series.data[1]}</div>`,
                  `<div><span class="tooltip-label"><strong>Last ${period} Average</strong></span> ${totalPeriodAverage}</div>`,
                  '</div>',
                  `<div class="tooltip-date">${startDate} - ${endDate}</div>`,
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
            <Button
              size="small"
              external
              href="https://docs.sentry.io/product/releases/setup/"
            >
              {t('Learn More')}
            </Button>
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
                    pathname: `/organizations/${organization.slug}/releases/`,
                    query: {project: project.id},
                  }}
                />
              </ProjectBadgeContainer>

              <ScoreWrapper>{this.renderReleaseCount(project.id, 'period')}</ScoreWrapper>
              <ScoreWrapper>
                <Link
                  to={{
                    pathname: `/organizations/${organization.slug}/releases/`,
                    query: {project: project.id, statsPeriod: '7d'},
                  }}
                >
                  {this.renderReleaseCount(project.id, 'week')}
                </Link>
              </ScoreWrapper>
              <ScoreWrapper>{this.renderTrend(project.id)}</ScoreWrapper>
            </Fragment>
          ))}
        </StyledPanelTable>
      </div>
    );
  }
}

export default withTheme(TeamReleases as ComponentType<Props>);

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

const SubText = styled('div')<{color: Color}>`
  color: ${p => p.theme[p.color]};
`;
