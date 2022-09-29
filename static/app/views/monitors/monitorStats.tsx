import MiniBarChart from 'sentry/components/charts/miniBarChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import {Panel, PanelBody} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {SeriesDataUnit} from 'sentry/types/echarts';
import theme from 'sentry/utils/theme';
import useApiRequests from 'sentry/utils/useApiRequests';

import {Monitor, MonitorStat} from './types';

type Props = {
  monitor: Monitor;
};

type State = {
  stats: MonitorStat[] | null;
};

const MonitorStats = ({monitor}: Props) => {
  const until = Math.floor(new Date().getTime() / 1000);
  const since = until - 3600 * 24 * 30;
  const {data, renderComponent} = useApiRequests<State>({
    endpoints: [
      [
        'stats',
        `/monitors/${monitor.id}/stats/`,
        {
          query: {
            since: since.toString(),
            until: until.toString(),
            resolution: '1d',
          },
        },
      ],
    ],
  });

  let emptyStats = true;
  const success = {
    seriesName: t('Successful'),
    data: [] as SeriesDataUnit[],
  };
  const failed = {
    seriesName: t('Failed'),
    data: [] as SeriesDataUnit[],
  };

  data.stats?.forEach(p => {
    if (p.ok || p.error) {
      emptyStats = false;
    }
    const timestamp = p.ts * 1000;
    success.data.push({name: timestamp, value: p.ok});
    failed.data.push({name: timestamp, value: p.error});
  });
  const colors = [theme.green300, theme.red300];

  return renderComponent(
    <Panel>
      <PanelBody withPadding>
        {!emptyStats ? (
          <MiniBarChart
            isGroupedByDate
            showTimeInTooltip
            labelYAxisExtents
            stacked
            colors={colors}
            height={150}
            series={[success, failed]}
          />
        ) : (
          <EmptyMessage
            title={t('Nothing recorded in the last 30 days.')}
            description={t('All check-ins for this monitor.')}
          />
        )}
      </PanelBody>
    </Panel>
  );
};

export default MonitorStats;
