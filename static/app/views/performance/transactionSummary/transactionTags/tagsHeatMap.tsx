import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {EChartOption} from 'echarts';
import {Location} from 'history';

import HeatMapChart from 'app/components/charts/heatMapChart';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {Panel} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Series} from 'app/types/echarts';
import {axisDuration, axisLabelFormatter} from 'app/utils/discover/charts';
import EventView from 'app/utils/discover/eventView';
import {TableData as TagTableData} from 'app/utils/performance/segmentExplorer/tagKeyHistogramQuery';
import {Theme} from 'app/utils/theme';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  tagKey: string;
};

const findRowKey = row => {
  return Object.keys(row).find(key => key.includes('histogram'));
};

const TagsHeatMap = (
  props: Props & {
    theme: Theme;
    tableData: TagTableData | null;
    isLoading: boolean;
  }
) => {
  const {tableData, isLoading} = props;

  if (!tableData || !tableData.data || !tableData.data.length) {
    return null;
  }

  // TODO(k-fish): Replace with actual theme colors.
  const purples = ['#D1BAFC', '#9282F3', '#6056BA', '#313087', '#021156'];

  const rowKey = findRowKey(tableData.data[0]);
  if (!rowKey) {
    return null;
  }

  const columnNames = new Set();
  const xValues = new Set();
  let maxCount = 0;

  const _data = tableData.data.map(row => {
    const x = axisDuration(row[rowKey] as number);
    const y = row.tags_value;
    columnNames.add(y);
    xValues.add(x);

    maxCount = Math.max(maxCount, row.count);

    return [x, y, row.count] as number[];
  });

  _data.sort((a, b) => {
    if (a[0] === b[0]) {
      return b[1] - a[1];
    }
    return b[0] - a[0];
  });

  // TODO(k-fish): Cleanup options
  const chartOptions = {
    height: 290,
    animation: false,
    colors: purples,
    tooltip: {},
    yAxis: {
      type: 'category' as const,
      data: Array.from(columnNames),
      splitArea: {
        show: true,
      },
    } as any, // TODO(k-fish): Expand typing to allow data option
    xAxis: {
      boundaryGap: true,
      type: 'category' as const,
      splitArea: {
        show: true,
      },
      data: Array.from(xValues),
      axisLabel: {
        show: true,
        showMinLabel: true,
        showMaxLabel: true,
        formatter: (value: number) => axisLabelFormatter(value, 'Count'),
      },
      axisLine: {},
      axisPointer: {
        show: false,
      },
      axisTick: {
        show: true,
        interval: 0,
        alignWithLabel: true,
      },
    } as any, // TODO(k-fish): Expand typing to allow data option

    grid: {
      left: space(3),
      right: space(3),
      top: '25px', // Need to bump top spacing past space(3) so the chart title doesn't overlap.
      bottom: space(4),
    },
  };

  const visualMaps = [
    {
      min: 0,
      max: maxCount,
      show: false,
      orient: 'horizontal',
      calculable: true,
      inRange: {
        color: purples,
      },
    } as EChartOption.VisualMap,
  ];

  const series: Series[] = [];

  series.push({
    seriesName: 'Count',
    dataArray: _data,
    label: {
      show: true,
    },
    emphasis: {
      itemStyle: {
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
      },
    },
  } as any); // TODO(k-fish): Fix heatmap data typing

  const reloading = isLoading;
  const loading = isLoading;

  return (
    <StyledPanel>
      <StyledHeaderTitleLegend>
        {t('Heat Map')}
        <QuestionTooltip
          size="sm"
          position="top"
          title={t(
            'This heatmap shows the frequency for each duration across the most common tag values'
          )}
        />
      </StyledHeaderTitleLegend>

      <TransitionChart loading={loading} reloading={reloading}>
        <TransparentLoadingMask visible={reloading} />

        <HeatMapChart visualMaps={visualMaps} series={series} {...chartOptions} />
      </TransitionChart>
    </StyledPanel>
  );
};

const StyledPanel = styled(Panel)`
  padding: ${space(3)};
  margin-bottom: 0;
  border-bottom: 0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
`;
const StyledHeaderTitleLegend = styled(HeaderTitleLegend)``;

export default withTheme(TagsHeatMap);
