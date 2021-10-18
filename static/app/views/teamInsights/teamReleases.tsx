import {ComponentType, Fragment} from 'react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import chunk from 'lodash/chunk';
import isEqual from 'lodash/isEqual';
import round from 'lodash/round';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import BarChart from 'app/components/charts/barChart';
import MarkLine from 'app/components/charts/components/markLine';
import {DateTimeObject} from 'app/components/charts/utils';
import IdBadge from 'app/components/idBadge';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import PanelTable from 'app/components/panels/panelTable';
import Placeholder from 'app/components/placeholder';
import {IconArrow} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Color, Theme} from 'app/utils/theme';

type Props = AsyncComponent['props'] & {
  theme: Theme;
  organization: Organization;
  teamSlug: string;
  projects: Project[];
} & DateTimeObject;

type ProjectReleaseCount = {
  project_avgs: Record<string, number>;
  release_counts: Record<string, number>;
  last_week_totals: Record<string, number>;
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
            ...getParams(datetime),
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
    const {projects, period, theme} = this.props;
    const {periodReleases} = this.state;

    const data = Object.entries(periodReleases?.release_counts ?? {})
      .map(([bucket, count]) => ({
        value: Math.ceil(count),
        name: new Date(bucket).getTime(),
      }))
      .sort((a, b) => a.name - b.name);

    // Convert from days to 7 day groups
    const seriesData = chunk(data, 7).map(week => {
      return {
        name: week[0].name,
        value: week.reduce((total, currentData) => total + currentData.value, 0),
      };
    });

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
            xAxis={{
              type: 'time',
            }}
            series={[
              {
                seriesName: t('This Period'),
                silent: true,
                data: seriesData,
                markLine: MarkLine({
                  silent: true,
                  lineStyle: {color: theme.gray200, type: 'dashed', width: 1},
                  data: [{yAxis: totalPeriodAverage} as any],
                }),
              } as any,
            ]}
            tooltip={{
              formatter: seriesParams => {
                // `seriesParams` can be an array or an object :/
                const [series] = Array.isArray(seriesParams)
                  ? seriesParams
                  : [seriesParams];

                const dateFormat = 'MMM D';
                const startDate = moment(series.axisValue).format(dateFormat);
                const endDate = moment(series.axisValue)
                  .add(7, 'days')
                  .format(dateFormat);
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
          headers={[
            t('Project'),
            <RightAligned key="last">
              {tct('Last [period] Average', {period})}
            </RightAligned>,
            <RightAligned key="curr">{t('This Week')}</RightAligned>,
            <RightAligned key="diff">{t('Difference')}</RightAligned>,
          ]}
        >
          {projects.map(project => (
            <Fragment key={project.id}>
              <ProjectBadgeContainer>
                <ProjectBadge avatarSize={18} project={project} />
              </ProjectBadgeContainer>

              <ScoreWrapper>{this.renderReleaseCount(project.id, 'period')}</ScoreWrapper>
              <ScoreWrapper>{this.renderReleaseCount(project.id, 'week')}</ScoreWrapper>
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

const SubText = styled('div')<{color: Color}>`
  color: ${p => p.theme[p.color]};
`;

const ProjectBadgeContainer = styled('div')`
  display: flex;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;
