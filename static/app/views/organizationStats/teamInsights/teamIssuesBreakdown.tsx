import {Fragment} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import AsyncComponent from 'sentry/components/asyncComponent';
import BarChart, {BarChartSeries} from 'sentry/components/charts/barChart';
import {DateTimeObject} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PanelTable from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';

import CollapsePanel, {COLLAPSE_COUNT} from './collapsePanel';
import {ProjectBadge, ProjectBadgeContainer} from './styles';
import {barAxisLabel, convertDayValueObjectToSeries, sortSeriesByDay} from './utils';

type StatusCounts = {
  total: number;
  deleted?: number;
  ignored?: number;
  new?: number;
  regressed?: number;
  resolved?: number;
  unignored?: number;
};

type IssuesBreakdown = Record<string, Record<string, StatusCounts>>;

type Statuses = keyof Omit<StatusCounts, 'total'>;

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
  statuses: Statuses[];
  teamSlug: string;
  environment?: string;
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  issuesBreakdown: IssuesBreakdown | null;
};

const keys = ['deleted', 'ignored', 'resolved', 'unignored', 'regressed', 'new', 'total'];

class TeamIssuesBreakdown extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      issuesBreakdown: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, start, end, period, utc, teamSlug, statuses, environment} =
      this.props;
    const datetime = {start, end, period, utc};

    return [
      [
        'issuesBreakdown',
        `/teams/${organization.slug}/${teamSlug}/issue-breakdown/`,
        {
          query: {
            ...normalizeDateTimeParams(datetime),
            statuses,
            environment,
          },
        },
      ],
    ];
  }

  componentDidUpdate(prevProps: Props) {
    const {start, end, period, utc, teamSlug, projects, environment} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc ||
      prevProps.teamSlug !== teamSlug ||
      prevProps.environment !== environment ||
      !isEqual(prevProps.projects, projects)
    ) {
      this.remountComponent();
    }
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {loading} = this.state;
    const issuesBreakdown = this.state.issuesBreakdown ?? {};
    const {projects, statuses} = this.props;

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
            ignored: 0,
            resolved: 0,
            unignored: 0,
            regressed: 0,
            new: 0,
            total: 0,
          };
        }

        for (const key of keys) {
          projectTotals[projectId][key] += counts[key];
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

    const allSeries = Object.keys(allReviewedByDay).map(
      (projectId, idx): BarChartSeries => ({
        seriesName: ProjectsStore.getById(projectId)?.slug ?? projectId,
        data: sortSeriesByDay(convertDayValueObjectToSeries(allReviewedByDay[projectId])),
        animationDuration: 500,
        animationDelay: idx * 500,
        silent: true,
        barCategoryGap: '5%',
      })
    );

    return (
      <Fragment>
        <IssuesChartWrapper>
          {loading && <Placeholder height="200px" />}
          {!loading && (
            <BarChart
              style={{height: 200}}
              stacked
              isGroupedByDate
              useShortDate
              legend={{right: 0, top: 0}}
              xAxis={barAxisLabel(allSeries[0]?.data.length ?? 0)}
              yAxis={{minInterval: 1}}
              series={allSeries}
            />
          )}
        </IssuesChartWrapper>
        <CollapsePanel items={sortedProjectIds.length}>
          {({isExpanded, showMoreButton}) => (
            <Fragment>
              <StyledPanelTable
                numActions={statuses.length}
                headers={[
                  t('Project'),
                  ...statuses.map(action => (
                    <AlignRight key={action}>{t(action)}</AlignRight>
                  )),
                  <AlignRight key="total">
                    {t('total')}{' '}
                    <IconArrow direction="down" size="12px" color="gray300" />
                  </AlignRight>,
                ]}
                isLoading={loading}
              >
                {sortedProjectIds.map(({projectId}, idx) => {
                  const project = projects.find(p => p.id === projectId);

                  if (idx >= COLLAPSE_COUNT && !isExpanded) {
                    return null;
                  }

                  return (
                    <Fragment key={projectId}>
                      <ProjectBadgeContainer>
                        {project && <ProjectBadge avatarSize={18} project={project} />}
                      </ProjectBadgeContainer>
                      {statuses.map(action => (
                        <AlignRight key={action}>
                          {projectTotals[projectId][action]}
                        </AlignRight>
                      ))}
                      <AlignRight>{projectTotals[projectId].total}</AlignRight>
                    </Fragment>
                  );
                })}
              </StyledPanelTable>
              {!loading && showMoreButton}
            </Fragment>
          )}
        </CollapsePanel>
      </Fragment>
    );
  }
}

export default TeamIssuesBreakdown;

const ChartWrapper = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
`;

const IssuesChartWrapper = styled(ChartWrapper)`
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledPanelTable = styled(PanelTable)<{numActions: number}>`
  grid-template-columns: 1fr ${p => ' 0.2fr'.repeat(p.numActions)} 0.2fr;
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
  box-shadow: unset;

  & > div {
    padding: ${space(1)} ${space(2)};
  }
`;

const AlignRight = styled('div')`
  text-align: right;
  font-variant-numeric: tabular-nums;
`;
