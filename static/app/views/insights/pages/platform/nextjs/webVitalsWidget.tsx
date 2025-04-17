import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import PerformanceScoreRingWithTooltips from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';
import {getWebVitalScoresFromTableDataRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';
import type {ProjectScore} from 'sentry/views/insights/browser/webVitals/types';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {ModalChartContainer} from 'sentry/views/insights/pages/platform/laravel/styles';
import {Toolbar} from 'sentry/views/insights/pages/platform/laravel/toolbar';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';

export function WebVitalsWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const {interval: _, ...pageFilterChartParams} = usePageFilterChartParams();

  // frontend > web vitals uses this query but I got no results with it
  // const webVitalsQuery = `transaction.op:[pageload,""] span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,""] !transaction:"<< unparameterized >>"`;

  // putting anything in the query will return no results for INP :(

  const fullQuery = `${query}`.trim();

  const {data, isLoading, error} = useApiQuery<{
    data: Array<{
      'avg(measurements.score.weight.cls)': number;
      'avg(measurements.score.weight.fcp)': number;
      'avg(measurements.score.weight.inp)': number;
      'avg(measurements.score.weight.lcp)': number;
      'avg(measurements.score.weight.ttfb)': number;
      'count()': number;
      'count_scores(measurements.score.cls)': number;
      'count_scores(measurements.score.fcp)': number;
      'count_scores(measurements.score.lcp)': number;
      'count_scores(measurements.score.total)': number;
      'count_scores(measurements.score.ttfb)': number;
      'performance_score(measurements.score.cls)': number;
      'performance_score(measurements.score.fcp)': number;
      'performance_score(measurements.score.inp)': number;
      'performance_score(measurements.score.lcp)': number;
      'performance_score(measurements.score.total)': number;
      'performance_score(measurements.score.ttfb)': number;
    }>;
  }>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          dataset: 'spans',
          field: [
            'performance_score(measurements.score.lcp)',
            'performance_score(measurements.score.fcp)',
            'performance_score(measurements.score.cls)',
            `performance_score(measurements.score.inp)`,
            'performance_score(measurements.score.ttfb)',
            'performance_score(measurements.score.total)',
            'avg(measurements.score.weight.lcp)',
            'avg(measurements.score.weight.fcp)',
            'avg(measurements.score.weight.cls)',
            `avg(measurements.score.weight.inp)`,
            'avg(measurements.score.weight.ttfb)',
            'avg(measurements.score.total)',
            'count()',
            'count_scores(measurements.score.total)',
            'count_scores(measurements.score.lcp)',
            'count_scores(measurements.score.fcp)',
            'count_scores(measurements.score.cls)',
            'count_scores(measurements.score.ttfb)',
            `count_scores(measurements.score.inp)`,
          ],
          partial: 1,
          useRpc: 1,
          query: fullQuery,
          // TODO: add web vitals referrer
          referrer: Referrer.CACHE_CHART,
        },
      },
    ],
    {staleTime: 0}
  );

  const projectScore = useMemo(() => {
    const projectData = data?.data?.[0];

    if (!projectData) {
      return {
        lcpScore: 0,
        fcpScore: 0,
        clsScore: 0,
        ttfbScore: 0,
        inpScore: 0,
        totalScore: 0,
      };
    }

    // @ts-expect-error - TODO: deal with this later
    return getWebVitalScoresFromTableDataRow(projectData);
  }, [data]);

  const isEmpty = projectScore.totalScore === 0;

  const visualization = (
    <WidgetVisualizationStates
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      VisualizationType={WebVitalsWidgetVisualization}
      visualizationProps={{
        projectScore,
        text: projectScore.totalScore ?? 0,
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
}: {
  projectScore: ProjectScore;
  text: number;
}) {
  const theme = useTheme();
  const ringSegmentColors = theme.chart.getColorPalette(3).slice() as unknown as string[];
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  return (
    <WebVitalsWidgetVisualizationContainer>
      <PerformanceScoreRingWithTooltips
        projectScore={projectScore}
        text={text}
        width={260}
        height={220}
        size={180}
        ringBackgroundColors={ringBackgroundColors}
        ringSegmentColors={ringSegmentColors}
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
