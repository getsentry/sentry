import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import BaseChart from 'sentry/components/charts/baseChart';
import {space} from 'sentry/styles/space';
import type {SuspectAttributesResult} from 'sentry/views/explore/hooks/useSuspectAttributes';

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
  const cohort1Color = theme.chart.getColorPalette(0)?.[0];
  const cohort2Color = '#dddddd';

  return (
    <ChartWrapper>
      <ChartTitle>{attribute.attributeName}</ChartTitle>
      <BaseChart
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
          axisLabel: {
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
            name: 'Selected',
            itemStyle: {
              color: cohort1Color,
            },
          },
          {
            type: 'bar',
            data: attribute.cohort2.map(cohort => cohort.value),
            name: 'Baseline',
            itemStyle: {
              color: cohort2Color,
            },
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
