import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import AsyncComponent from 'sentry/components/asyncComponent';
import BarChart from 'sentry/components/charts/barChart';
import {DateTimeObject} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PanelTable from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {formatPercentage} from 'sentry/utils/formatters';

import {ProjectBadge, ProjectBadgeContainer} from './styles';
import {
  barAxisLabel,
  convertDaySeriesToWeeks,
  convertDayValueObjectToSeries,
} from './utils';

type IssuesBreakdown = Record<string, Record<string, {reviewed: number; total: number}>>;

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
  teamSlug: string;
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  issuesBreakdown: IssuesBreakdown | null;
};

class TeamIssuesReviewed extends AsyncComponent<Props, State> {
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
            ...normalizeDateTimeParams(datetime),
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
    const {issuesBreakdown, loading} = this.state;
    const {projects} = this.props;

    const allReviewedByDay: Record<string, number> = {};
    const allNotReviewedByDay: Record<string, number> = {};

    // Total reviewed & total reviewed keyed by project ID
    const projectTotals: Record<string, {reviewed: number; total: number}> = {};

    if (issuesBreakdown) {
      // The issues breakdown is split into projectId ->
      for (const [projectId, entries] of Object.entries(issuesBreakdown)) {
        for (const [bucket, {reviewed, total}] of Object.entries(entries)) {
          if (!projectTotals[projectId]) {
            projectTotals[projectId] = {reviewed: 0, total: 0};
          }
          projectTotals[projectId].reviewed += reviewed;
          projectTotals[projectId].total += total;

          if (allReviewedByDay[bucket] === undefined) {
            allReviewedByDay[bucket] = reviewed;
          } else {
            allReviewedByDay[bucket] += reviewed;
          }

          const notReviewed = total - reviewed;
          if (allNotReviewedByDay[bucket] === undefined) {
            allNotReviewedByDay[bucket] = notReviewed;
          } else {
            allNotReviewedByDay[bucket] += notReviewed;
          }
        }
      }
    }

    const reviewedSeries = convertDaySeriesToWeeks(
      convertDayValueObjectToSeries(allReviewedByDay)
    );
    const notReviewedSeries = convertDaySeriesToWeeks(
      convertDayValueObjectToSeries(allNotReviewedByDay)
    );

    return (
      <Fragment>
        <ChartWrapper>
          {loading && <Placeholder height="200px" />}
          {!loading && (
            <BarChart
              style={{height: 200}}
              stacked
              isGroupedByDate
              useShortDate
              legend={{right: 0, top: 0}}
              xAxis={barAxisLabel(reviewedSeries.length)}
              yAxis={{minInterval: 1}}
              series={[
                {
                  seriesName: t('Reviewed'),
                  data: reviewedSeries,
                  silent: true,
                  animationDuration: 500,
                  animationDelay: 0,
                  barCategoryGap: '5%',
                },
                {
                  seriesName: t('Not Reviewed'),
                  data: notReviewedSeries,
                  silent: true,
                  animationDuration: 500,
                  animationDelay: 500,
                  barCategoryGap: '5%',
                },
              ]}
            />
          )}
        </ChartWrapper>
        <StyledPanelTable
          isEmpty={projects.length === 0}
          emptyMessage={t('No projects assigned to this team')}
          headers={[
            t('Project'),
            <AlignRight key="forReview">{t('For Review')}</AlignRight>,
            <AlignRight key="reviewed">{t('Reviewed')}</AlignRight>,
            <AlignRight key="change">{t('% Reviewed')}</AlignRight>,
          ]}
          isLoading={loading}
        >
          {projects.map(project => {
            const {total, reviewed} = projectTotals[project.id] ?? {};
            return (
              <Fragment key={project.id}>
                <ProjectBadgeContainer>
                  <ProjectBadge avatarSize={18} project={project} />
                </ProjectBadgeContainer>
                <AlignRight>{total}</AlignRight>
                <AlignRight>{reviewed}</AlignRight>
                <AlignRight>
                  {total === 0 ? '\u2014' : formatPercentage(reviewed / total)}
                </AlignRight>
              </Fragment>
            );
          })}
        </StyledPanelTable>
      </Fragment>
    );
  }
}

export default TeamIssuesReviewed;

const ChartWrapper = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.2fr;
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
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

const AlignRight = styled('div')`
  text-align: right;
  font-variant-numeric: tabular-nums;
`;
