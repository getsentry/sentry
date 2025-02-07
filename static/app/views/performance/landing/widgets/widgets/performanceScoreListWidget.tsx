import type {ReactElement} from 'react';
import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import _EventsRequest from 'sentry/components/charts/eventsRequest';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {formatTimeSeriesResultsToChartData} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreBreakdownChart';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import {
  Badge,
  PerformanceBadge,
} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {useProjectWebVitalsScoresTimeseriesQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import {useTransactionWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useTransactionWebVitalsScoresQuery';
import {MODULE_DOC_LINK} from 'sentry/views/insights/browser/webVitals/settings';
import {applyStaticWeightsToTimeseries} from 'sentry/views/insights/browser/webVitals/utils/applyStaticWeightsToTimeseries';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';

import {Accordion} from '../components/accordion';
import {GenericPerformanceWidget} from '../components/performanceWidget';
import {
  GrowLink,
  RightAlignedCell,
  Subtitle,
  WidgetEmptyStateWarning,
} from '../components/selectableList';
import type {transformDiscoverToList} from '../transforms/transformDiscoverToList';
import type {transformEventsRequestToStackedArea} from '../transforms/transformEventsToStackedBars';
import type {PerformanceWidgetProps, WidgetDataResult} from '../types';

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToStackedArea>;
  list: WidgetDataResult & ReturnType<typeof transformDiscoverToList>;
};

export function PerformanceScoreListWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const [selectedListIndex, setSelectListIndex] = useState<number>(0);
  const {ContainerActions, InteractiveTitle} = props;
  const theme = useTheme();

  const {data: projectScoresData, isPending: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery();

  const {data: transactionWebVitals, isPending: isTransactionWebVitalsQueryLoading} =
    useTransactionWebVitalsScoresQuery({limit: 4});

  const {data: timeseriesData, isLoading: isTimeseriesQueryLoading} =
    useProjectWebVitalsScoresTimeseriesQuery({});

  const assembleAccordionItems = () =>
    getHeaders().map(header => ({header, content: getAreaChart()}));

  const order = ORDER;

  const weightedTimeseriesData = applyStaticWeightsToTimeseries(timeseriesData);

  const getAreaChart = () => {
    const segmentColors = (theme.charts.getColorPalette(3) ?? []).slice(0, 5);
    return (
      <Chart
        stacked
        height={props.chartHeight}
        data={formatTimeSeriesResultsToChartData(
          weightedTimeseriesData,
          segmentColors,
          order
        )}
        type={ChartType.AREA}
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
        hideYAxisSplitLine
      />
    );
  };

  const moduleURL = useModuleURL('vital');

  const getHeaders = () =>
    transactionWebVitals.map((listItem, i) => {
      const transaction = (listItem.transaction as string | undefined) ?? '';
      const scoreCount = projectScoresData?.data?.[0]?.[
        'count_scores(measurements.score.total)'
      ] as number;
      const opportunity = scoreCount ? (listItem.opportunity ?? 0) * 100 : 0;
      return (
        <Fragment key={i}>
          <GrowLink
            to={{
              pathname: `${moduleURL}/overview/`,
              query: {...location.query, transaction, project: listItem['project.id']},
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
                    <ExternalLink href={`${MODULE_DOC_LINK}#performance-score`}>
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
            {isProjectScoresLoading ? (
              <StyledLoadingIndicator size={20} />
            ) : (
              <Tooltip
                title={
                  <span>
                    {t(
                      "A number rating how impactful a performance improvement on this page would be to your application's overall Performance Score."
                    )}
                    <br />
                    <ExternalLink href={`${MODULE_DOC_LINK}#opportunity`}>
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
    });

  const getContainerActions = () => {
    return (
      <Fragment>
        <div>
          <LinkButton to={`${moduleURL}/`} size="sm">
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
      HeaderActions={() => getContainerActions()}
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
          component: () => (
            <Accordion
              expandedIndex={selectedListIndex}
              setExpandedIndex={setSelectListIndex}
              items={assembleAccordionItems()}
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
