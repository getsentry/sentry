import {useLayoutEffect, useRef, useState} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import BaseChart from 'sentry/components/charts/baseChart';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {SuspectAttributesResult} from 'sentry/views/explore/hooks/useSuspectAttributes';

const MAX_BAR_WIDTH = 20;

const SELECTED_SERIES_NAME = 'selected';
const BASELINE_SERIES_NAME = 'baseline';

type Props = {
  rankedAttributes: SuspectAttributesResult['rankedAttributes'];
};

// TODO Abdullah Khan: Add virtualization and search to the list of charts
export function Charts({rankedAttributes}: Props) {
  const theme = useTheme();
  return (
    <ChartsWrapper>
      {rankedAttributes.map(attribute => (
        <Chart key={attribute.attributeName} attribute={attribute} theme={theme} />
      ))}
    </ChartsWrapper>
  );
}

function Chart({
  attribute,
  theme,
}: {
  attribute: SuspectAttributesResult['rankedAttributes'][number];
  theme: Theme;
}) {
  const chartRef = useRef<ReactEchartsRef>(null);
  const [hideLabels, setHideLabels] = useState(false);

  const cohort1Color = theme.chart.getColorPalette(0)?.[0];
  const cohort2Color = '#dddddd';

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
    <ChartWrapper>
      <ChartTitle>{attribute.attributeName}</ChartTitle>
      <BaseChart
        ref={chartRef}
        autoHeightResize
        isGroupedByDate={false}
        tooltip={{
          trigger: 'axis',
          confine: true,
        }}
        grid={{
          left: 2,
          right: 8,
          containLabel: true,
        }}
        xAxis={{
          show: true,
          type: 'category',
          data: attribute.cohort1.map(cohort => cohort.label),
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
            data: attribute.cohort1.map(cohort => cohort.value),
            name: SELECTED_SERIES_NAME,
            itemStyle: {
              color: cohort1Color,
            },
            barMaxWidth: MAX_BAR_WIDTH,
            animation: false,
          },
          {
            type: 'bar',
            data: attribute.cohort2.map(cohort => cohort.value),
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
  );
}

const ChartsWrapper = styled('div')`
  flex: 1;
  overflow: auto;
  overflow-y: scroll;
  overscroll-behavior: none;
`;

const ChartWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 200px;
  padding: ${space(2)} ${space(2)} 0 ${space(2)};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const ChartTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.gray500};
`;
