import PropTypes from 'prop-types';
import React from 'react';

import AsyncComponent from 'app/components/asyncComponent';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import MiniBarChart from 'app/components/charts/miniBarChart';
import theme from 'app/utils/theme';

export default class MonitorStats extends AsyncComponent {
  static propTypes = {
    monitor: PropTypes.object.isRequired,
    ...AsyncComponent.PropTypes,
  };

  getDefaultState() {
    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 30;

    return {
      since,
      until,
    };
  }

  getEndpoints() {
    const {monitor} = this.props;
    return [
      [
        'stats',
        `/monitors/${monitor.id}/stats/`,
        {
          query: {
            since: this.state.since,
            until: this.state.until,
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
      data: [],
    };
    const failed = {
      seriesName: t('Failed'),
      data: [],
    };
    this.state.stats.forEach(p => {
      if (p.ok || p.error) {
        emptyStats = false;
      }
      const timestamp = p.ts * 1000;
      success.data.push({name: timestamp, value: p.ok});
      failed.data.push({name: timestamp, value: p.error});
    });
    const colors = [theme.green300, theme.red500];

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
