import {Fragment, ReactElement, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Accordion from 'sentry/components/accordion/accordion';
import {LinkButton} from 'sentry/components/button';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {
  Badge,
  PerformanceBadge,
} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {formatTimeSeriesResultsToChartData} from 'sentry/views/performance/browser/webVitals/components/performanceScoreBreakdownChart';
import {calculateOpportunity} from 'sentry/views/performance/browser/webVitals/utils/calculateOpportunity';
import {calculatePerformanceScoreFromTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {useProjectRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {useProjectWebVitalsTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useProjectWebVitalsTimeseriesQuery';
import {useTransactionWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useTransactionWebVitalsQuery';
import {RowWithScoreAndOpportunity} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';
import Chart from 'sentry/views/starfish/components/chart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {
  GrowLink,
  RightAlignedCell,
  Subtitle,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import {transformDiscoverToList} from '../transforms/transformDiscoverToList';
import {transformEventsRequestToStackedArea} from '../transforms/transformEventsToStackedBars';
import {PerformanceWidgetProps, WidgetDataResult} from '../types';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToStackedArea>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

export function PerformanceScoreListWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const {ContainerActions, organization, InteractiveTitle} = props;
  const theme = useTheme();
  const shouldUseStoredScores = useStoredScoresSetting();

  const {data: projectData, isLoading: isProjectWebVitalDataLoading} =
    useProjectRawWebVitalsQuery();
  const {data: projectScoresData, isLoading: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery({
      enabled: shouldUseStoredScores,
    });

  const projectScore = shouldUseStoredScores
    ? calculatePerformanceScoreFromStoredTableDataRow(projectScoresData?.data?.[0])
    : calculatePerformanceScoreFromTableDataRow(projectData?.data?.[0]);

  const {data: transactionWebVitals, isLoading: isTransactionWebVitalsQueryLoading} =
    useTransactionWebVitalsQuery({limit: 4});

  const {data: timeseriesData, isLoading: isTimeseriesQueryLoading} =
    useProjectWebVitalsTimeseriesQuery({});

  const assembleAccordionItems = provided =>
    getHeaders(provided).map(header => ({header, content: getAreaChart(provided)}));

  const getAreaChart = _ =>
    function () {
      const segmentColors = theme.charts.getColorPalette(3);
      return (
        <Chart
          stacked
          height={props.chartHeight}
          data={formatTimeSeriesResultsToChartData(
            timeseriesData,
            segmentColors,
            !shouldUseStoredScores
          )}
          disableXAxis
          loading={false}
          grid={{
            left: 5,
            right: 5,
            top: 5,
            bottom: 0,
          }}
          dataMax={100}
          chartColors={segmentColors}
        />
      );
    };

  const getHeaders = _ =>
    transactionWebVitals.map(
      listItem =>
        function () {
          const transaction = (listItem.transaction as string | undefined) ?? '';
          const count = projectData?.data?.[0]?.['count()'] as number;
          const scoreCount = projectScoresData?.data?.[0]?.[
            'count_scores(measurements.score.total)'
          ] as number;
          const opportunity = shouldUseStoredScores
            ? scoreCount
              ? (((listItem as RowWithScoreAndOpportunity).opportunity ?? 0) * 100) /
                scoreCount
              : 0
            : count !== undefined
            ? calculateOpportunity(
                projectScore.totalScore ?? 0,
                count,
                listItem.totalScore,
                listItem['count()']
              )
            : 0;
          return (
            <Fragment>
              <GrowLink
                to={{
                  pathname: '/performance/browser/pageloads/overview/',
                  query: {...location.query, transaction},
                }}
              >
                <Truncate value={transaction} maxLength={40} />
              </GrowLink>
              <StyledRightAlignedCell>
                {listItem.totalScore !== null && (
                  <Tooltip
                    title={
                      <span>
                        {t('The overall performance rating of this page.')}
                        <br />
                        <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/#performance-score">
                          {t('How is this calculated?')}
                        </ExternalLink>
                      </span>
                    }
                    isHoverable
                  >
                    <PerformanceBadgeWrapper>
                      <PerformanceBadge score={listItem.totalScore} />
                    </PerformanceBadgeWrapper>
                  </Tooltip>
                )}
                {isProjectWebVitalDataLoading ||
                (isProjectScoresLoading && shouldUseStoredScores) ? (
                  <StyledLoadingIndicator size={20} />
                ) : (
                  <Tooltip
                    title={
                      <span>
                        {t(
                          "A number rating how impactful a performance improvement on this page would be to your application's overall Performance Score."
                        )}
                        <br />
                        <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/#opportunity">
                          {t('How is this calculated?')}
                        </ExternalLink>
                      </span>
                    }
                    isHoverable
                    showUnderline
                    skipWrapper
                  >
                    {Math.round(opportunity * 100) / 100}
                  </Tooltip>
                )}
              </StyledRightAlignedCell>
            </Fragment>
          );
        }
    );

  const getContainerActions = _ => {
    return (
      <Fragment>
        <div>
          <LinkButton
            to={`/organizations/${organization.slug}/performance/browser/pageloads/`}
            size="sm"
          >
            {t('View All')}
          </LinkButton>
        </div>
        {ContainerActions && (
          <ContainerActions isLoading={isTransactionWebVitalsQueryLoading} />
        )}
      </Fragment>
    );
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      location={location}
      Subtitle={() => <Subtitle>{props.subTitle}</Subtitle>}
      HeaderActions={provided => getContainerActions(provided)}
      InteractiveTitle={
        InteractiveTitle
          ? provided => <InteractiveTitle {...provided.widgetData?.chart} />
          : null
      }
      EmptyComponent={WidgetEmptyStateWarning}
      Queries={{
        // The queries aren't actually happening here, but we propagate these to manage loading state
        timeseries: {
          component: (provided): ReactElement => {
            return (
              <Fragment>
                {provided.children({
                  data: timeseriesData,
                  isLoading: isTimeseriesQueryLoading,
                  hasData:
                    !isTimeseriesQueryLoading &&
                    Object.values(timeseriesData).some(array => array.length > 0),
                })}
              </Fragment>
            );
          },
          fields: [],
          transform: function (_: any, results: any) {
            return results;
          },
        },
        transaction: {
          component: (provided): ReactElement => {
            return (
              <Fragment>
                {provided.children({
                  data: transactionWebVitals,
                  isLoading: isTransactionWebVitalsQueryLoading,
                  hasData:
                    !isTransactionWebVitalsQueryLoading &&
                    transactionWebVitals.length > 0,
                })}
              </Fragment>
            );
          },
          fields: [],
          transform: function (_: any, results: any) {
            return results;
          },
        },
      }}
      Visualizations={[
        {
          component: provided => (
            <Accordion
              expandedIndex={selectedListIndex}
              setExpandedIndex={setSelectListIndex}
              items={assembleAccordionItems(provided)}
            />
          ),
          height: 124 + props.chartHeight,
          noPadding: true,
        },
      ]}
    />
  );
}

const StyledRightAlignedCell = styled(RightAlignedCell)`
  justify-content: space-between;
  width: 115px;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  &,
  .loading-message {
    margin: 0;
  }
`;

const PerformanceBadgeWrapper = styled('span')`
  ${Badge} {
    text-decoration: underline dotted;
  }
`;
