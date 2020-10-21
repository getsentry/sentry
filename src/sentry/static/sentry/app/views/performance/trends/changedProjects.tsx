import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {Panel} from 'app/components/panels';
import Button from 'app/components/button';
import LoadingIndicator from 'app/components/loadingIndicator';
import withApi from 'app/utils/withApi';
import withProjects from 'app/utils/withProjects';
import withOrganization from 'app/utils/withOrganization';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Client} from 'app/api';
import {t, tct} from 'app/locale';
import QuestionTooltip from 'app/components/questionTooltip';
import {formatPercentage, getDuration} from 'app/utils/formatters';
import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';

import ProjectTrendsDiscoverQuery from './projectTrendsDiscoverQuery';
import {
  TrendChangeType,
  TrendFunctionField,
  TrendView,
  NormalizedProjectTrend,
} from './types';
import {
  modifyTrendView,
  normalizeTrends,
  trendToColor,
  getTrendProjectId,
  getCurrentTrendFunction,
} from './utils';
import {HeaderTitleLegend} from '../styles';

type Props = {
  api: Client;
  organization: Organization;
  trendChangeType: TrendChangeType;
  previousTrendFunction?: TrendFunctionField;
  trendView: TrendView;
  location: Location;
  projects: Project[];
};

function getTitle(trendChangeType: TrendChangeType): string {
  switch (trendChangeType) {
    case TrendChangeType.IMPROVED:
      return t('Most Improved Project');
    case TrendChangeType.REGRESSION:
      return t('Most Regressed Project');
    default:
      throw new Error('No trend type passed');
  }
}

function getDescription(
  trendChangeType: TrendChangeType,
  trendView: TrendView,
  projectTrend: NormalizedProjectTrend
) {
  const absolutePercentChange = formatPercentage(
    Math.abs(projectTrend.percentage_aggregate_range_2_aggregate_range_1 - 1),
    0
  );

  const project = <strong>{projectTrend.project}</strong>;

  const currentPeriodValue = projectTrend.aggregate_range_2;
  const previousPeriodValue = projectTrend.aggregate_range_1;

  const previousValue = getDuration(
    previousPeriodValue / 1000,
    previousPeriodValue < 1000 ? 0 : 2
  );
  const currentValue = getDuration(
    currentPeriodValue / 1000,
    currentPeriodValue < 1000 ? 0 : 2
  );

  const absoluteChange = Math.abs(currentPeriodValue - previousPeriodValue);

  const absoluteChangeDuration = getDuration(
    absoluteChange / 1000,
    absoluteChange < 1000 ? 0 : 2
  );

  const period =
    trendView.statsPeriod && DEFAULT_RELATIVE_PERIODS[trendView.statsPeriod]
      ? DEFAULT_RELATIVE_PERIODS[trendView.statsPeriod].toLowerCase()
      : t('given timeframe');

  const improvedTemplate =
    'In the [period], [project] sped up by [absoluteChangeDuration] (a [percent] decrease in duration). See the top transactions that made that happen.';
  const regressedTemplate =
    'In the [period], [project] slowed down by [absoluteChangeDuration] (a [percent] increase in duration). See the top transactions that made that happen.';
  const template =
    trendChangeType === TrendChangeType.IMPROVED ? improvedTemplate : regressedTemplate;

  return tct(template, {
    project,
    period,
    percent: absolutePercentChange,
    absoluteChangeDuration,
    previousValue,
    currentValue,
  });
}

function handleViewTransactions(
  projectTrend: NormalizedProjectTrend,
  projects: Project[],
  location: Location
) {
  const projectId = getTrendProjectId(projectTrend, projects);
  browserHistory.push({
    pathname: location.pathname,
    query: {
      ...location.query,
      project: [projectId],
    },
  });
}

function ChangedProjects(props: Props) {
  const {location, trendView, organization, projects, trendChangeType} = props;
  const projectTrendView = trendView.clone();

  const containerTitle = getTitle(trendChangeType);
  modifyTrendView(projectTrendView, location, trendChangeType, true);

  return (
    <ProjectTrendsDiscoverQuery
      eventView={projectTrendView}
      orgSlug={organization.slug}
      location={location}
      trendChangeType={trendChangeType}
      limit={1}
    >
      {({isLoading, projectTrendsData}) => {
        const trends = projectTrendsData?.data || [];
        const trendFunction = getCurrentTrendFunction(location);
        const events = normalizeTrends(trends, trendFunction);

        const transactionsList = events && events.slice ? events.slice(0, 5) : [];
        const projectTrend = transactionsList[0];

        const titleTooltipContent = t(
          'This shows the project with largest changes across its transactions'
        );

        return (
          <TrendsProjectPanel>
            <div>
              <StyledHeaderTitleLegend>
                {containerTitle}{' '}
                <QuestionTooltip size="sm" position="top" title={titleTooltipContent} />
              </StyledHeaderTitleLegend>
            </div>
            {isLoading ? (
              <EmptyContainer>
                <LoadingIndicator mini />
              </EmptyContainer>
            ) : (
              <React.Fragment>
                {transactionsList.length ? (
                  <React.Fragment>
                    <ProjectTrendContainer>
                      {getDescription(trendChangeType, trendView, projectTrend)}
                    </ProjectTrendContainer>
                  </React.Fragment>
                ) : (
                  <EmptyContainer>
                    <EmptyStateWarning small>{t('No results')}</EmptyStateWarning>
                  </EmptyContainer>
                )}
                {projectTrend && (
                  <StyledProjectButton
                    onClick={() =>
                      handleViewTransactions(projectTrend, projects, location)
                    }
                    size="small"
                  >
                    {t('View Transactions')}
                  </StyledProjectButton>
                )}
              </React.Fragment>
            )}
            {projectTrend &&
              !isLoading &&
              getVisualization(trendChangeType, projectTrend)}
          </TrendsProjectPanel>
        );
      }}
    </ProjectTrendsDiscoverQuery>
  );
}

const StyledHeaderTitleLegend = styled(HeaderTitleLegend)`
  padding: 0;
`;

const TrendsProjectPanel = styled(Panel)`
  display: grid;
  grid-gap: ${space(1)};
  padding: ${space(3)};
  grid-template-columns: auto 120px;
  grid-template-rows: 20px auto 40px;
  margin: 0;
`;

const EmptyContainer = styled('div')`
  display: flex;
  justify-content: center;
  grid-column: 1/3;
  grid-row: 2/4;
`;

const ProjectTrendContainer = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray600};
  grid-column: 1/2;
`;

const StyledProjectButton = styled(Button)`
  align-self: end;
  justify-self: start;
`;

function getVisualization(
  trendChangeType: TrendChangeType,
  projectTrend: NormalizedProjectTrend
) {
  const color = trendToColor[trendChangeType];

  const trendPercent = formatPercentage(
    projectTrend.percentage_aggregate_range_2_aggregate_range_1 - 1,
    0
  );

  return (
    <TrendCircle color={color}>
      <TrendCirclePercentage>
        {trendChangeType === TrendChangeType.REGRESSION ? '+' : ''}
        {trendPercent}
      </TrendCirclePercentage>
      <TrendCircleProject>{projectTrend.project}</TrendCircleProject>
    </TrendCircle>
  );
}

const TrendCircle = styled('div')<{color: string}>`
  width: 120px;
  height: 120px;
  border: 5px solid ${p => p.color};
  border-radius: 50%;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  grid-column: 2/3;
  grid-row: 1/4;
`;

const TrendCirclePercentage = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
`;

const TrendCircleProject = styled('div')`
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-align: center;
  width: 80px;
  ${overflowEllipsis};
`;

export default withApi(withProjects(withOrganization(ChangedProjects)));
