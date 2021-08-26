import AsyncComponent from 'app/components/asyncComponent';
import MiniBarChart from 'app/components/charts/miniBarChart';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import theme from 'app/utils/theme';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import {Monitor, MonitorStat} from './types';

type Props = AsyncComponent['props'] & {
  monitor: Monitor;
};

type State = AsyncComponent['state'] & {
  stats: MonitorStat[] | null;
};

type Stat = {name: string; value: number};

export default class MonitorStats extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {monitor} = this.props;
    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 30;
    return [
      [
        'stats',
        `/monitors/${monitor.id}/stats/`,
        {
          query: {
            since,
            until,
            resolution: '1d',
          },
        },
      ],
    ];
  }

  renderBody() {
    let emptyStats = true;
    const success = {
      seriesName: t('Successful'),
      data: [] as Stat[],
    };
    const failed = {
      seriesName: t('Failed'),
      data: [] as Stat[],
    };
    this.state.stats?.forEach(p => {
      if (p.ok || p.error) {
        emptyStats = false;
      }
      const timestamp = p.ts * 1000;
      success.data.push({name: timestamp.toString(), value: p.ok});
      failed.data.push({name: timestamp.toString(), value: p.error});
    });
    const colors = [theme.green300, theme.red300];

    return (
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
  }
}
