import {Fragment} from 'react';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import TextField from 'sentry/components/forms/fields/textField';
import InternalStatChart from 'sentry/components/internalStatChart';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';

type Config = {
  backend: string;
  options: Record<string, string>;
};

type State = DeprecatedAsyncComponent['state'] & {
  config: Config;
  resolution: string;
  since: number;
};

export default class AdminQuotas extends DeprecatedAsyncComponent<{}, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      since: new Date().getTime() / 1000 - 3600 * 24 * 7,
      resolution: '1h',
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
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
