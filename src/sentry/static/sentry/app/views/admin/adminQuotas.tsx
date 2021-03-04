import React from 'react';

import {TextField} from 'app/components/forms';
import InternalStatChart from 'app/components/internalStatChart';
import AsyncView from 'app/views/asyncView';

type Config = {
  backend: string;
  options: Record<string, string>;
};

type State = AsyncView['state'] & {
  since: number;
  resolution: string;
  config: Config;
};

export default class AdminQuotas extends AsyncView<{}, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      since: new Date().getTime() / 1000 - 3600 * 24 * 7,
      resolution: '1h',
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['config', '/internal/quotas/']];
  }

  renderBody() {
    const {config} = this.state;
    return (
      <div>
        <h3>Quotas</h3>

        <div className="box">
          <div className="box-header">
            <h4>Config</h4>
          </div>

          <div className="box-content with-padding">
            <TextField name="backend" value={config.backend} label="Backend" disabled />
            <TextField
              name="rateLimit"
              value={config.options['system.rate-limit']}
              label="Rate Limit"
              disabled
            />
          </div>
        </div>

        <div className="box">
          <div className="box-header">
            <h4>Total Events</h4>
          </div>
          <InternalStatChart
            since={this.state.since}
            resolution={this.state.resolution}
            stat="events.total"
            label="Events"
          />
        </div>

        <div className="box">
          <div className="box-header">
            <h4>Dropped Events</h4>
          </div>
          <InternalStatChart
            since={this.state.since}
            resolution={this.state.resolution}
            stat="events.dropped"
            label="Events"
          />
        </div>
      </div>
    );
  }
}
