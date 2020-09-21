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
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Client} from 'app/api';
import {t, tct} from 'app/locale';
import QuestionTooltip from 'app/components/questionTooltip';
import {formatPercentage, getDuration} from 'app/utils/formatters';
import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';

import {
  TrendChangeType,
  TrendFunctionField,
  TrendView,
  ProjectTrendsData,
  NormalizedProjectTrend,
} from './types';
import {modifyTrendView, normalizeTrends, trendToColor, getTrendProjectId} from './utils';
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
      return t('Worst Regressed Project');
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

  const period = trendView.statsPeriod
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

function getNoResultsDescription(trendChangeType: TrendChangeType) {
  return trendChangeType === TrendChangeType.IMPROVED
    ? t('The glass is half empty today. There are only regressions so get back to work.')
    : t(
        'The glass is half full today. There are only improvements so get some ice cream.'
      );
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
    <DiscoverQuery
      eventView={projectTrendView}
      orgSlug={organization.slug}
      location={location}
      trendChangeType={trendChangeType}
      limit={1}
    >
      {({isLoading, tableData}) => {
        const eventsTrendsData = (tableData as unknown) as ProjectTrendsData;
        const trends = eventsTrendsData?.events?.data || [];
        const events = normalizeTrends(trends);

        const transactionsList = events && events.slice ? events.slice(0, 5) : [];
        const projectTrend = transactionsList[0];

        const titleTooltipContent = t(
          'This shows the project with largest changes across its transactions'
        );

        return (
          <ChangedProjectsContainer>
            <StyledPanel>
              <DescriptionContainer>
                <ContainerTitle>
                  <HeaderTitleLegend>
                    {containerTitle}{' '}
                    <QuestionTooltip
                      size="sm"
                      position="top"
                      title={titleTooltipContent}
                    />
                  </HeaderTitleLegend>
                </ContainerTitle>
                {isLoading ? (
                  <LoadingIndicatorContainer>
                    <LoadingIndicator mini />
                  </LoadingIndicatorContainer>
                ) : (
                  <React.Fragment>
                    {transactionsList.length ? (
                      <React.Fragment>
                        <ProjectTrendContainer>
                          <div>
                            {getDescription(trendChangeType, trendView, projectTrend)}
                          </div>
                        </ProjectTrendContainer>
                      </React.Fragment>
                    ) : (
                      <ProjectTrendContainer>
                        <div>{getNoResultsDescription(trendChangeType)}</div>
                      </ProjectTrendContainer>
                    )}
                    {projectTrend && (
                      <ButtonContainer>
                        <Button
                          onClick={() =>
                            handleViewTransactions(projectTrend, projects, location)
                          }
                          size="small"
                        >
                          {t('View Transactions')}
                        </Button>
                      </ButtonContainer>
                    )}
                  </React.Fragment>
                )}
              </DescriptionContainer>
              <VisualizationContainer>
                {projectTrend &&
                  !isLoading &&
                  getVisualization(trendChangeType, projectTrend)}
              </VisualizationContainer>
            </StyledPanel>
          </ChangedProjectsContainer>
        );
      }}
    </DiscoverQuery>
  );
}

const StyledPanel = styled(Panel)`
  display: flex;
  flex-direction: row;
`;
const DescriptionContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 185px;
`;
const VisualizationContainer = styled('div')``;
const ChangedProjectsContainer = styled('div')``;
const ContainerTitle = styled('div')`
  padding-top: ${space(3)};
  padding-left: ${space(2)};
`;
const LoadingIndicatorContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;
const ProjectTrendContainer = styled('div')`
  padding: ${space(2)};

  margin-top: ${space(1)};
  margin-left: ${space(1)};

  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray600};
`;
const ButtonContainer = styled('div')`
  padding-left: ${space(2)};
  margin-left: ${space(1)};
  padding-bottom: ${space(2)};
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
    <div>
      <TrendCircle color={color}>
        <TrendCircleContent>
          <TrendCirclePrimary>
            {trendChangeType === TrendChangeType.REGRESSION ? '+' : ''}
            {trendPercent}
          </TrendCirclePrimary>
          <TrendCircleSecondary>{projectTrend.project}</TrendCircleSecondary>
        </TrendCircleContent>
      </TrendCircle>
    </div>
  );
}

const TrendCircle = styled('div')<{color: string}>`
  width: 124px;
  height: 124px;
  margin: ${space(3)};
  border-style: solid;
  border-width: 5px;
  border-radius: 50%;
  border-color: ${p => p.color};

  display: flex;
  align-items: center;
  justify-content: center;
`;
const TrendCircleContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
`;
const TrendCirclePrimary = styled('div')`
  font-size: 26px;
  line-height: 37px;
`;
const TrendCircleSecondary = styled('div')`
  font-size: 12px;
  line-height: 12px;
  color: ${p => p.theme.gray500};
`;

export default withApi(withProjects(withOrganization(ChangedProjects)));
