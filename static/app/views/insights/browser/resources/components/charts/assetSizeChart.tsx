import {tct} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import getDynamicText from 'sentry/utils/getDynamicText';
import {DATA_TYPE} from 'sentry/views/insights/browser/resources/settings';
import {AVG_COLOR} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';

interface Props {
  isLoading: boolean;
  series: Series[];
  error?: Error | null;
}

export function AssetSizeChart({series, isLoading}: Props) {
  return (
    <ChartPanel title={tct('Average [dataType] Size', {dataType: DATA_TYPE})}>
      <Chart
        height={160}
        aggregateOutputFormat="size"
        data={series}
        loading={isLoading}
        chartColors={[AVG_COLOR]}
        type={ChartType.LINE}
        definedAxisTicks={4}
        tooltipFormatterOptions={{
          valueFormatter: bytes =>
            getDynamicText({
              value: formatBytesBase2(bytes),
              fixed: 'xx KiB',
            }),
          nameFormatter: name => DataTitles[name],
        }}
      />
    </ChartPanel>
  );
}
