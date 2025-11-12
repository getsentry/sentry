import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import PerformanceScoreRingWithTooltips from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';
import type {ProjectData} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import {getWebVitalScoresFromTableDataRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';
import type {ProjectScore} from 'sentry/views/insights/browser/webVitals/types';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {getPreviousPeriod} from 'sentry/views/insights/pages/platform/nextjs/utils';
import {ModalChartContainer} from 'sentry/views/insights/pages/platform/shared/styles';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import type {SpanProperty} from 'sentry/views/insights/types';

const FIELDS: SpanProperty[] = [
  'avg(measurements.score.total)',
  'performance_score(measurements.score.lcp)',
  'performance_score(measurements.score.fcp)',
  'performance_score(measurements.score.cls)',
  'performance_score(measurements.score.inp)',
  'performance_score(measurements.score.ttfb)',
  'performance_score(measurements.score.total)',
  'count()',
  'count_scores(measurements.score.total)',
  'count_scores(measurements.score.lcp)',
  'count_scores(measurements.score.fcp)',
  'count_scores(measurements.score.cls)',
  'count_scores(measurements.score.ttfb)',
  'count_scores(measurements.score.inp)',
  'p75(measurements.lcp)',
  'p75(measurements.fcp)',
  'p75(measurements.cls)',
  'p75(measurements.ttfb)',
  'p75(measurements.inp)',
];

const percentageChange = (a?: number, b?: number) => {
  if (a === undefined || b === undefined || b === 0) {
    return 0;
  }
  return ((a - b) / b) * 100;
};

type ProjectScoreQuery = {
  error: Error | null;
  isLoading: boolean;
  data?: {
    differenceToPreviousPeriod: ProjectScore;
    projectData: ProjectData[];
    projectScore: ProjectScore;
  };
};

function usePerformanceScoreData({query}: {query?: string}): ProjectScoreQuery {
  const {interval: _, ...pageFilterChartParams} = usePageFilterChartParams();

  const currentRequest = useSpans(
    {
      search: query,
      fields: FIELDS,
    },
    Referrer.WEB_VITALS_CHART
  );

  const previousPeriodParams = useMemo(
    () =>
      getPreviousPeriod({
        start: pageFilterChartParams.start,
        end: pageFilterChartParams.end,
        period: pageFilterChartParams.statsPeriod,
      }),
    [
      pageFilterChartParams.start,
      pageFilterChartParams.end,
      pageFilterChartParams.statsPeriod,
    ]
  );

  const previousRequest = useSpans(
    {
      pageFilters: {
        projects: pageFilterChartParams.project,
        environments: pageFilterChartParams.environment,
        datetime: {
          start: previousPeriodParams?.start ?? null,
          end: previousPeriodParams?.end ?? null,
          period: null,
          utc: !!pageFilterChartParams.utc,
        },
      },
      search: query,
      fields: FIELDS,
      enabled: !!previousPeriodParams,
    },
    Referrer.WEB_VITALS_CHART
  );

  if (currentRequest.isLoading || currentRequest.error) {
    return {...currentRequest, data: undefined};
  }

  if (previousRequest.isLoading || previousRequest.error) {
    return {...previousRequest, data: undefined};
  }

  const currentScores = getWebVitalScoresFromTableDataRow(currentRequest.data[0]);
  const previousScores = getWebVitalScoresFromTableDataRow(previousRequest.data?.[0]);

  return {
    isLoading: false,
    error: null,
    data: {
      projectScore: currentScores,
      projectData: currentRequest.data,
      differenceToPreviousPeriod: {
        lcpScore: percentageChange(currentScores.lcpScore, previousScores?.lcpScore),
        fcpScore: percentageChange(currentScores.fcpScore, previousScores?.fcpScore),
        clsScore: percentageChange(currentScores.clsScore, previousScores?.clsScore),
        ttfbScore: percentageChange(currentScores.ttfbScore, previousScores?.ttfbScore),
        inpScore: percentageChange(currentScores.inpScore, previousScores?.inpScore),
        totalScore: percentageChange(
          currentScores.totalScore,
          previousScores?.totalScore
        ),
      },
    },
  };
}

export function WebVitalsWidget() {
  const organization = useOrganization();
  const {query} = useTransactionNameQuery();
  const {data, isLoading, error} = usePerformanceScoreData({query});

  const isEmpty = !isLoading && data?.projectScore.totalScore === 0;

  const visualization = (
    <WidgetVisualizationStates
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      VisualizationType={WebVitalsWidgetVisualization}
      visualizationProps={{
        projectScore: data?.projectScore!,
        text: data?.projectScore.totalScore ?? 0,
        projectData: data?.projectData,
        differenceToPreviousPeriod: data?.differenceToPreviousPeriod,
      }}
    />
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Web Vitals')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        !isEmpty && (
          <Toolbar
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Web Vitals'),
                children: <ModalChartContainer>{visualization}</ModalChartContainer>,
              });
            }}
          />
        )
      }
    />
  );
}

function WebVitalsWidgetVisualization({
  projectScore,
  text,
  projectData,
  differenceToPreviousPeriod,
}: {
  projectScore: ProjectScore;
  text: number;
  differenceToPreviousPeriod?: ProjectScore;
  projectData?: ProjectData[];
}) {
  const theme = useTheme();
  const ringSegmentColors = theme.chart.getColorPalette(4).slice() as unknown as string[];
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  return (
    <WebVitalsWidgetVisualizationContainer>
      <PerformanceScoreRingWithTooltips
        projectScore={projectScore}
        projectData={projectData}
        differenceToPreviousPeriod={differenceToPreviousPeriod}
        text={text}
        width={260}
        height={240}
        y={46}
        x={60}
        size={130}
        radiusPadding={20}
        labelHeightPadding={-5}
        ringBackgroundColors={ringBackgroundColors}
        ringSegmentColors={ringSegmentColors}
        inPerformanceWidget
      />
    </WebVitalsWidgetVisualizationContainer>
  );
}

WebVitalsWidgetVisualization.LoadingPlaceholder =
  TimeSeriesWidgetVisualization.LoadingPlaceholder;

const WebVitalsWidgetVisualizationContainer = styled('div')`
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;
