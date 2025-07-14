import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Virtualizer} from '@tanstack/react-virtual';
import {useVirtualizer} from '@tanstack/react-virtual';
import type {TooltipComponentFormatterCallbackParams} from 'echarts';
import type {CallbackDataParams} from 'echarts/types/dist/shared';

import BaseChart from 'sentry/components/charts/baseChart';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {SuspectAttributesResult} from 'sentry/views/explore/hooks/useSuspectAttributes';

const MAX_BAR_WIDTH = 20;

const SELECTED_SERIES_NAME = 'selected';
const BASELINE_SERIES_NAME = 'baseline';

type Props = {
  rankedAttributes: SuspectAttributesResult['rankedAttributes'];
  searchQuery: string;
};

// TODO Abdullah Khan: Add virtualization and search to the list of charts
export function Charts({rankedAttributes, searchQuery}: Props) {
  const theme = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rankedAttributes.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <ChartsWrapper ref={scrollContainerRef}>
      <AllItemsContainer height={virtualizer.getTotalSize()}>
        {virtualItems.map(item => (
          <VirtualOffset key={item.index} offset={item.start}>
            <Chart
              key={`${item.key}+${searchQuery}`}
              index={item.index}
              virtualizer={virtualizer}
              attribute={rankedAttributes[item.index]!}
              theme={theme}
            />
          </VirtualOffset>
        ))}
      </AllItemsContainer>
    </ChartsWrapper>
  );
}

type CohortData = SuspectAttributesResult['rankedAttributes'][number]['cohort1'];

function cohortsToSeriesData(
  cohort1: CohortData,
  cohort2: CohortData
): {
  [BASELINE_SERIES_NAME]: Array<{label: string; value: string}>;
  [SELECTED_SERIES_NAME]: Array<{label: string; value: string}>;
} {
  const cohort1Map = new Map(cohort1.map(({label, value}) => [label, value]));
  const cohort2Map = new Map(cohort2.map(({label, value}) => [label, value]));

  const uniqueLabels = new Set([
    ...cohort1.map(c => c.label),
    ...cohort2.map(c => c.label),
  ]);

  // From the unique labels, we create two series data objects, one for the selected cohort and one for the baseline cohort.
  // If a label isn't present in either of the cohorts, we assign a value of 0, to that label in the respective series.
  const seriesData = Array.from(uniqueLabels).map(label => {
    const selectedVal = cohort1Map.get(label) ?? '0';
    const baselineVal = cohort2Map.get(label) ?? '0';

    // We sort by descending value of the selected cohort
    const sortVal = Number(selectedVal);

    return {
      label,
      selectedValue: selectedVal,
      baselineValue: baselineVal,
      sortValue: sortVal,
    };
  });

  seriesData.sort((a, b) => b.sortValue - a.sortValue);

  const selectedSeriesData = seriesData.map(({label, selectedValue}) => ({
    label,
    value: selectedValue,
  }));

  const baselineSeriesData = seriesData.map(({label, baselineValue}) => ({
    label,
    value: baselineValue,
  }));

  return {
    [SELECTED_SERIES_NAME]: selectedSeriesData,
    [BASELINE_SERIES_NAME]: baselineSeriesData,
  };
}

// TODO Abdullah Khan: This is a temporary function to get the totals of the cohorts. Will be removed
// once the backend returns the totals.
function cohortTotals(
  cohort1: CohortData,
  cohort2: CohortData
): {
  [BASELINE_SERIES_NAME]: number;
  [SELECTED_SERIES_NAME]: number;
} {
  const cohort1Total = cohort1.reduce((acc, curr) => acc + Number(curr.value), 0);
  const cohort2Total = cohort2.reduce((acc, curr) => acc + Number(curr.value), 0);
  return {
    [SELECTED_SERIES_NAME]: cohort1Total,
    [BASELINE_SERIES_NAME]: cohort2Total,
  };
}

function Chart({
  attribute,
  theme,
  index,
  virtualizer,
}: {
  attribute: SuspectAttributesResult['rankedAttributes'][number];
  index: number;
  theme: Theme;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}) {
  const chartRef = useRef<ReactEchartsRef>(null);
  const [hideLabels, setHideLabels] = useState(false);

  const cohort1Color = theme.chart.getColorPalette(0)?.[0];
  const cohort2Color = '#dddddd';

  const seriesData = useMemo(
    () => cohortsToSeriesData(attribute.cohort1, attribute.cohort2),
    [attribute.cohort1, attribute.cohort2]
  );

  const seriesTotals = useMemo(
    () => cohortTotals(attribute.cohort1, attribute.cohort2),
    [attribute.cohort1, attribute.cohort2]
  );

  const valueFormatter = useCallback(
    (_value: number, label?: string, seriesParams?: CallbackDataParams) => {
      const data = Number(seriesParams?.data);
      const total = seriesTotals[label as keyof typeof seriesTotals];

      if (total === 0) {
        return '\u2014';
      }

      const percentage = (data / total) * 100;
      return `${percentage.toFixed(1)}%`;
    },
    [seriesTotals]
  );

  const formatAxisLabel = useCallback(
    (
      _value: number,
      _isTimestamp: boolean,
      _utc: boolean,
      _showTimeInTooltip: boolean,
      _addSecondsToTimeFormat: boolean,
      _bucketSize: number | undefined,
      seriesParamsOrParam: TooltipComponentFormatterCallbackParams
    ) => {
      if (!Array.isArray(seriesParamsOrParam)) {
        return '\u2014';
      }

      const selectedParam = seriesParamsOrParam.find(
        s => s.seriesName === SELECTED_SERIES_NAME
      );
      const baselineParam = seriesParamsOrParam.find(
        s => s.seriesName === BASELINE_SERIES_NAME
      );

      if (!selectedParam || !baselineParam) {
        throw new Error('selectedParam or baselineParam is not defined');
      }

      const selectedTotal =
        seriesTotals[selectedParam?.seriesName as keyof typeof seriesTotals];
      const selectedData = Number(selectedParam?.data);
      const selectedPercentage =
        selectedTotal === 0 ? 0 : (selectedData / selectedTotal) * 100;

      const baselineTotal =
        seriesTotals[baselineParam?.seriesName as keyof typeof seriesTotals];
      const baselineData = Number(baselineParam?.data);
      const baselinePercentage =
        baselineTotal === 0 ? 0 : (baselineData / baselineTotal) * 100;

      const isDifferent = selectedPercentage.toFixed(1) !== baselinePercentage.toFixed(1);

      const status = isDifferent
        ? {adjective: 'different', message: 'This is suspicious.'}
        : {adjective: 'similar', message: 'Nothing unusual here.'};

      const name = selectedParam?.name ?? baselineParam?.name ?? '';
      const truncatedName = name.length > 300 ? `${name.slice(0, 300)}...` : name;

      return `<div style="max-width: 200px; white-space: normal; word-wrap: break-word; line-height: 1.2;">${truncatedName} <span style="color: ${theme.textColor};">is <strong>${status.adjective}</strong> ${isDifferent ? 'between' : 'across'} selected and baseline data. ${status.message}</span></div>`;
    },
    [seriesTotals, theme.textColor]
  );

  useLayoutEffect(() => {
    const chartContainer = chartRef.current?.getEchartsInstance().getDom();
    if (!chartContainer) return;

    const labels = chartContainer.querySelectorAll('.echarts-for-react text');

    for (const label of labels) {
      const labelRect = (label as SVGGraphicsElement).getBoundingClientRect();
      const containerRect = chartContainer.getBoundingClientRect();

      // If there are any labels exceeding the boundaries of the chart container, we hide
      // hide all labels.
      if (labelRect.left < containerRect.left || labelRect.right > containerRect.right) {
        setHideLabels(true);
        break;
      }
    }
  }, [attribute]);

  return (
    <div ref={virtualizer.measureElement} data-index={index}>
      <ChartWrapper>
        <ChartTitle>{attribute.attributeName}</ChartTitle>
        <BaseChart
          ref={chartRef}
          autoHeightResize
          isGroupedByDate={false}
          tooltip={{
            trigger: 'axis',
            appendToBody: true,
            renderMode: 'html',
            valueFormatter,
            formatAxisLabel,
          }}
          grid={{
            left: 2,
            right: 8,
            containLabel: true,
          }}
          xAxis={{
            show: true,
            type: 'category',
            data: seriesData[SELECTED_SERIES_NAME].map(cohort => cohort.label),
            truncate: 14,
            axisLabel: hideLabels
              ? {show: false}
              : {
                  hideOverlap: true,
                  showMaxLabel: false,
                  showMinLabel: false,
                  color: '#000',
                  interval: 0,
                  formatter: (value: string) => value,
                },
          }}
          yAxis={{
            type: 'value',
            axisLabel: {
              show: false,
              width: 0,
            },
          }}
          series={[
            {
              type: 'bar',
              data: seriesData[SELECTED_SERIES_NAME].map(cohort => cohort.value),
              name: SELECTED_SERIES_NAME,
              itemStyle: {
                color: cohort1Color,
              },
              barMaxWidth: MAX_BAR_WIDTH,
              animation: false,
            },
            {
              type: 'bar',
              data: seriesData[BASELINE_SERIES_NAME].map(cohort => cohort.value),
              name: BASELINE_SERIES_NAME,
              itemStyle: {
                color: cohort2Color,
              },
              barMaxWidth: MAX_BAR_WIDTH,
              animation: false,
            },
          ]}
        />
      </ChartWrapper>
    </div>
  );
}

const ChartsWrapper = styled('div')`
  height: 100%;
  overflow: auto;
  overflow-y: scroll;
  overscroll-behavior: none;
`;

const AllItemsContainer = styled('div')<{height: number}>`
  position: relative;
  width: 100%;
  height: ${p => p.height}px;
`;

const VirtualOffset = styled('div')<{offset: number}>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  transform: translateY(${p => p.offset}px);
`;

const ChartWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 200px;
  padding-top: ${space(1.5)};
  border-top: 1px solid ${p => p.theme.border};
`;

const ChartTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.gray500};
`;
