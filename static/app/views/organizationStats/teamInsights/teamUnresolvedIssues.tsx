import {Fragment} from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import BarChart from 'sentry/components/charts/barChart';
import {DateTimeObject} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PanelTable from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {formatPercentage} from 'sentry/utils/formatters';
import type {Color} from 'sentry/utils/theme';

import CollapsePanel, {COLLAPSE_COUNT} from './collapsePanel';
import {ProjectBadge, ProjectBadgeContainer} from './styles';
import {
  barAxisLabel,
  convertDayValueObjectToSeries,
  groupByTrend,
  sortSeriesByDay,
} from './utils';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
  teamSlug: string;
  environment?: string;
} & DateTimeObject;

type UnresolvedCount = {unresolved: number};
type ProjectReleaseCount = Record<string, Record<string, UnresolvedCount>>;

type State = AsyncComponent['state'] & {
  expandTable: boolean;
  /** weekly selected date range */
  periodIssues: ProjectReleaseCount | null;
};

class TeamUnresolvedIssues extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      periodIssues: null,
      expandTable: false,
    };
  }

  getEndpoints() {
    const {organization, start, end, period, utc, teamSlug, environment} = this.props;

    const datetime = {start, end, period, utc};

    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [
      [
        'periodIssues',
        `/teams/${organization.slug}/${teamSlug}/all-unresolved-issues/`,
        {
          query: {
            ...normalizeDateTimeParams(datetime),
            environment,
          },
        },
      ],
    ];

    return endpoints;
  }

  componentDidUpdate(prevProps: Props) {
    const {teamSlug, start, end, period, utc, environment} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc ||
      prevProps.environment !== environment ||
      prevProps.teamSlug !== teamSlug
    ) {
      this.remountComponent();
    }
  }

  getTotalUnresolved(projectId: number): number {
    const {periodIssues} = this.state;

    const entries = Object.values(periodIssues?.[projectId] ?? {});
    const total = entries.reduce((acc, current) => acc + current.unresolved, 0);

    return Math.round(total / entries.length);
  }

  handleExpandTable = () => {
    this.setState({expandTable: true});
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {projects, period} = this.props;
    const {loading} = this.state;
    const periodIssues = this.state.periodIssues ?? {};

    const projectTotals: Record<
      string,
      {percentChange: number; periodAvg: number; projectId: string; today: number}
    > = {};
    for (const projectId of Object.keys(periodIssues)) {
      const periodAvg = this.getTotalUnresolved(Number(projectId));
      const projectPeriodEntries = Object.values(periodIssues?.[projectId] ?? {});
      const today =
        projectPeriodEntries[projectPeriodEntries.length - 1]?.unresolved ?? 0;
      const percentChange = Math.abs((today - periodAvg) / periodAvg);
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

    return (
      <div>
        <ChartWrapper>
          {loading && <Placeholder height="200px" />}
          {!loading && (
            <BarChart
              style={{height: 190}}
              isGroupedByDate
              useShortDate
              legend={{right: 3, top: 0}}
              yAxis={{minInterval: 1}}
              xAxis={barAxisLabel(seriesData.length)}
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
                isLoading={loading}
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
                  const totals = projectTotals[project.id] ?? {};

                  if (idx >= COLLAPSE_COUNT && !isExpanded) {
                    return null;
                  }

                  return (
                    <Fragment key={project.id}>
                      <ProjectBadgeContainer>
                        <ProjectBadge avatarSize={18} project={project} />
                      </ProjectBadgeContainer>

                      <ScoreWrapper>{totals.periodAvg}</ScoreWrapper>
                      <ScoreWrapper>{totals.today}</ScoreWrapper>
                      <ScoreWrapper>
                        <SubText
                          color={
                            totals.percentChange === 0
                              ? 'gray300'
                              : totals.percentChange > 0
                              ? 'red300'
                              : 'green300'
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
              {!loading && showMoreButton}
            </Fragment>
          )}
        </CollapsePanel>
      </div>
    );
  }
}

export default TeamUnresolvedIssues;

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
