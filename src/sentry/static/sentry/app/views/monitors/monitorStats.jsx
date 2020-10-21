import PropTypes from 'prop-types';

import AsyncComponent from 'app/components/asyncComponent';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import StackedBarChart from 'app/components/stackedBarChart';

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

  renderTooltip(point, _pointIdx, chart) {
    const timeLabel = chart.getTimeLabel(point);
    const [error, ok] = point.y;

    return (
      <div style={{width: '150px'}}>
        <div className="time-label">{timeLabel}</div>
        <div className="value-label">
          {t('%s successful', ok.toLocaleString())}
          <br />
          {t('%s failed', error.toLocaleString())}
        </div>
      </div>
    );
  }

  renderBody() {
    let emptyStats = true;
    const stats = this.state.stats.map(p => {
      if (p.ok || p.error) {
        emptyStats = false;
      }
      return {
        x: p.ts,
        y: [p.error, p.ok],
      };
    });

    return (
      <Panel>
        <PanelBody>
          {!emptyStats ? (
            <StackedBarChart
              points={stats}
              height={150}
              label="events"
              barClasses={['error', 'success']}
              className="standard-barchart"
              style={{border: 'none'}}
              tooltip={this.renderTooltip}
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
