import {Fragment} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import AsyncComponent from 'sentry/components/asyncComponent';
import BarChart from 'sentry/components/charts/barChart';
import {DateTimeObject} from 'sentry/components/charts/utils';
import IdBadge from 'sentry/components/idBadge';
import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
import PanelTable from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';

import {
  barAxisLabel,
  convertDaySeriesToWeeks,
  convertDayValueObjectToSeries,
} from './utils';

type IssuesBreakdown = Record<
  string,
  Record<
    string,
    {
      resolved?: number;
      ignored?: number;
      deleted?: number;
      new?: number;
      regressed?: number;
      unignored?: number;
      total: number;
    }
  >
>;

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
  teamSlug: string;
  actions: string[];
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  issuesBreakdown: IssuesBreakdown | null;
};

const keys = ['deleted', 'ignored', 'resolved', 'unignored', 'regressed', 'new', 'total'];

const mock = {
  '5711442': {
    '2021-11-19T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-20T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-21T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-22T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-23T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-24T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-25T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-26T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-27T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-28T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-29T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-30T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-01T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-02T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-03T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-04T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-05T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-06T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-07T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-08T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-09T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-10T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-11T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-12T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-13T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-14T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-15T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-16T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
  },
  '1': {
    '2021-11-19T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-20T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-21T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-22T00:00:00+00:00': {
      deleted: 11,
      ignored: 11,
      resolved: 11,
      unignored: 11,
      regressed: 11,
      new: 11,
      total: 11,
    },
    '2021-11-23T00:00:00+00:00': {
      deleted: 7,
      ignored: 7,
      resolved: 7,
      unignored: 7,
      regressed: 7,
      new: 7,
      total: 7,
    },
    '2021-11-24T00:00:00+00:00': {
      deleted: 4,
      ignored: 4,
      resolved: 4,
      unignored: 4,
      regressed: 4,
      new: 4,
      total: 4,
    },
    '2021-11-25T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-26T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-27T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-28T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-29T00:00:00+00:00': {
      deleted: 8,
      ignored: 8,
      resolved: 8,
      unignored: 8,
      regressed: 8,
      new: 8,
      total: 8,
    },
    '2021-11-30T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-01T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-02T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-03T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-04T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-05T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-06T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-07T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-08T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-09T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-10T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-11T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-12T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-13T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-14T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-15T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-16T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
  },
  '11276': {
    '2021-11-19T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-20T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-21T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-22T00:00:00+00:00': {
      deleted: 9,
      ignored: 9,
      resolved: 9,
      unignored: 9,
      regressed: 9,
      new: 9,
      total: 9,
    },
    '2021-11-23T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-24T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-25T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-26T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-27T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-28T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-29T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-11-30T00:00:00+00:00': {
      deleted: 33,
      ignored: 33,
      resolved: 33,
      unignored: 33,
      regressed: 33,
      new: 33,
      total: 33,
    },
    '2021-12-01T00:00:00+00:00': {
      deleted: 22,
      ignored: 22,
      resolved: 22,
      unignored: 22,
      regressed: 22,
      new: 22,
      total: 22,
    },
    '2021-12-02T00:00:00+00:00': {
      deleted: 7,
      ignored: 7,
      resolved: 7,
      unignored: 7,
      regressed: 7,
      new: 7,
      total: 7,
    },
    '2021-12-03T00:00:00+00:00': {
      deleted: 50,
      ignored: 50,
      resolved: 50,
      unignored: 50,
      regressed: 50,
      new: 50,
      total: 50,
    },
    '2021-12-04T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-05T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-06T00:00:00+00:00': {
      deleted: 8,
      ignored: 8,
      resolved: 8,
      unignored: 8,
      regressed: 8,
      new: 8,
      total: 8,
    },
    '2021-12-07T00:00:00+00:00': {
      deleted: 1,
      ignored: 1,
      resolved: 1,
      unignored: 1,
      regressed: 1,
      new: 1,
      total: 1,
    },
    '2021-12-08T00:00:00+00:00': {
      deleted: 1,
      ignored: 1,
      resolved: 1,
      unignored: 1,
      regressed: 1,
      new: 1,
      total: 1,
    },
    '2021-12-09T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-10T00:00:00+00:00': {
      deleted: 1,
      ignored: 1,
      resolved: 1,
      unignored: 1,
      regressed: 1,
      new: 1,
      total: 1,
    },
    '2021-12-11T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-12T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-13T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-14T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-15T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
    '2021-12-16T00:00:00+00:00': {
      deleted: 0,
      ignored: 0,
      resolved: 0,
      unignored: 0,
      regressed: 0,
      new: 0,
      total: 0,
    },
  },
};

class TeamIssuesActions extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      issuesBreakdown: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, start, end, period, utc, teamSlug} = this.props;
    const datetime = {start, end, period, utc};

    return [
      [
        'issuesBreakdown',
        `/teams/${organization.slug}/${teamSlug}/issue-breakdown/`,
        {
          query: {
            ...getParams(datetime),
          },
        },
      ],
    ];
  }

  componentDidUpdate(prevProps: Props) {
    const {start, end, period, utc, teamSlug, projects} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc ||
      prevProps.teamSlug !== teamSlug ||
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
    const {projects, actions} = this.props;
    // TODO: stop using mock
    const issuesBreakdown = mock;

    const allReviewedByDay: Record<string, Record<string, number>> = {};

    // Total reviewed & total reviewed keyed by project ID
    const projectTotals: any = {};

    if (issuesBreakdown) {
      // The issues breakdown is split into projectId ->
      for (const [projectId, entries] of Object.entries(issuesBreakdown)) {
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
    }

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
              xAxis={barAxisLabel(4)}
              yAxis={{minInterval: 1}}
              series={Object.keys(allReviewedByDay).map(projectId => ({
                seriesName: ProjectsStore.getById(projectId)?.slug ?? projectId,
                data: convertDaySeriesToWeeks(
                  convertDayValueObjectToSeries(allReviewedByDay[projectId])
                ),
                silent: true,
              }))}
            />
          )}
        </IssuesChartWrapper>
        <StyledPanelTable
          numActions={actions.length}
          headers={[
            t('Project'),
            ...actions.map(action => <AlignRight key={action}>{t(action)}</AlignRight>),
            <AlignRight key="total">{t('total')}</AlignRight>,
          ]}
          isLoading={loading}
        >
          {projects.map(project => {
            return (
              <Fragment key={project.id}>
                <ProjectBadgeContainer>
                  <ProjectBadge avatarSize={18} project={project} />
                </ProjectBadgeContainer>
                {actions.map(action => (
                  <AlignRight key={action}>
                    {projectTotals[project.id][action]}
                  </AlignRight>
                ))}
                <AlignRight>{projectTotals[project.id].total}</AlignRight>
              </Fragment>
            );
          })}
        </StyledPanelTable>
      </Fragment>
    );
  }
}

export default TeamIssuesActions;

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

const ProjectBadgeContainer = styled('div')`
  display: flex;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const AlignRight = styled('div')`
  text-align: right;
  font-variant-numeric: tabular-nums;
`;
