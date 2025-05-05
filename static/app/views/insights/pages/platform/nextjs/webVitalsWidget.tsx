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
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {ModalChartContainer} from 'sentry/views/insights/pages/platform/laravel/styles';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';

export function WebVitalsWidget({query}: {query?: string}) {
  const organization = useOrganization();
  const {interval: _, ...pageFilterChartParams} = usePageFilterChartParams();

  const {data, isLoading, error} = useEAPSpans(
    {
      ...pageFilterChartParams,
      search: query,
      fields: [
        'avg(measurements.score.total)',
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.cls)',
        `performance_score(measurements.score.inp)`,
        'performance_score(measurements.score.ttfb)',
        'performance_score(measurements.score.total)',
        'count()',
        'count_scores(measurements.score.total)',
        'count_scores(measurements.score.lcp)',
        'count_scores(measurements.score.fcp)',
        'count_scores(measurements.score.cls)',
        'count_scores(measurements.score.ttfb)',
        `count_scores(measurements.score.inp)`,
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.ttfb)',
        'p75(measurements.inp)',
      ],
    },
    Referrer.WEB_VITALS_CHART
  );

  const projectScore = useMemo(() => {
    const projectData = data?.[0];

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
        projectData: data,
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
}: {
  projectScore: ProjectScore;
  text: number;
  projectData?: ProjectData[];
}) {
  const theme = useTheme();
  const ringSegmentColors = theme.chart.getColorPalette(3).slice() as unknown as string[];
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  return (
    <WebVitalsWidgetVisualizationContainer>
      <PerformanceScoreRingWithTooltips
        projectScore={projectScore}
        projectData={projectData}
        text={text}
        width={260}
        height={220}
        y={36}
        size={160}
        radiusPadding={10}
        labelHeightPadding={0}
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
