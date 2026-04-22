import {Fragment, useRef, useState} from 'react';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconClock} from 'sentry/icons';
import {IconGraph} from 'sentry/icons/iconGraph';
import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import {ChartContextMenu} from 'sentry/views/explore/errors/charts/chartContextMenu';
import {CHART_HEIGHT} from 'sentry/views/explore/settings';
import {
  ChartList,
  ChartWrapper,
  EXPLORE_CHART_TYPE_OPTIONS,
} from 'sentry/views/explore/spans/charts';
import {prettifyAggregation} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

const ERRORS_CHART_GROUP = 'errors-charts_group';

export function ErrorsCharts() {
  return (
    <ChartList>
      <WidgetSyncContextProvider groupName={ERRORS_CHART_GROUP}>
        <Chart />
      </WidgetSyncContextProvider>
    </ChartList>
  );
}

function Chart() {
  const [chartVisible, setChartVisible] = useState(true);
  const [interval, setInterval, intervalOptions] = useChartInterval();

  const chartRef = useRef<ReactEchartsRef>(null);

  const Title = (
    <Flex>
      <Widget.WidgetTitle
        title={prettifyAggregation('count(errors)') ?? 'count(errors)'}
      />
    </Flex>
  );

  const Actions = (
    <Fragment>
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              aria-label={t('Chart type')}
              icon={<IconGraph type="line" />}
              priority="transparent"
              showChevron={false}
              size="xs"
            />
          )}
          value={ChartType.LINE}
          menuTitle="Type"
          options={EXPLORE_CHART_TYPE_OPTIONS}
          onChange={_option => {}}
        />
      </Tooltip>
      <Tooltip title={t('Time interval displayed in this visualization (ex. 5m)')}>
        <CompactSelect
          value={interval}
          onChange={option => setInterval(option.value)}
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              aria-label={t('Interval')}
              icon={<IconClock />}
              priority="transparent"
              showChevron={false}
              size="xs"
            />
          )}
          menuTitle="Interval"
          options={intervalOptions}
        />
      </Tooltip>
      <ChartContextMenu visible={chartVisible} setVisible={setChartVisible} />
    </Fragment>
  );

  return (
    <ChartWrapper>
      <Widget
        Title={Title}
        Actions={Actions}
        Visualization={
          chartVisible && (
            <ChartVisualization
              chartInfo={{
                chartType: ChartType.LINE,
                series: [],
                timeseriesResult: {} as ReturnType<typeof useSortedTimeSeries>,
                yAxis: 'count(errors)',
              }}
              chartRef={chartRef}
              chartXRangeSelection={undefined}
            />
          )
        }
        Footer={undefined}
        height={chartVisible ? CHART_HEIGHT : 50}
        revealActions="always"
      />
    </ChartWrapper>
  );
}
