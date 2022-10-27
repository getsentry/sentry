import {Fragment} from 'react';

import TextField from 'sentry/components/forms/fields/textField';
import InternalStatChart from 'sentry/components/internalStatChart';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import AsyncView from 'sentry/views/asyncView';

type Config = {
  backend: string;
  options: Record<string, string>;
};

type State = AsyncView['state'] & {
  config: Config;
  resolution: string;
  since: number;
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
      <Fragment>
        <h3>Quotas</h3>

        <Panel>
          <PanelHeader>{t('Config')}</PanelHeader>
          <PanelBody withPadding>
            <TextField
              name="backend"
              value={config.backend}
              label="Backend"
              disabled
              inline={false}
              stacked
            />
            <TextField
              name="rateLimit"
              value={config.options['system.rate-limit']}
              label="Rate Limit"
              disabled
              inline={false}
              stacked
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>{t('Total Events')}</PanelHeader>
          <PanelBody withPadding>
            <InternalStatChart
              since={this.state.since}
              resolution={this.state.resolution}
              stat="events.total"
              label="Events"
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>{t('Dropped Events')}</PanelHeader>
          <PanelBody withPadding>
            <InternalStatChart
              since={this.state.since}
              resolution={this.state.resolution}
              stat="events.dropped"
              label="Events"
            />
          </PanelBody>
        </Panel>
      </Fragment>
    );
  }
}
