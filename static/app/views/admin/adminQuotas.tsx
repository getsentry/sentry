import {Fragment, useState} from 'react';

import TextField from 'sentry/components/forms/fields/textField';
import InternalStatChart from 'sentry/components/internalStatChart';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';

type Config = {
  backend: string;
  options: Record<string, string>;
};

export default function AdminQuotas() {
  const {
    data: config,
    isPending,
    isError,
  } = useApiQuery<Config>(['/internal/quotas/'], {
    staleTime: 0,
  });
  const [since] = useState(() => new Date().getTime() / 1000 - 3600 * 24 * 7);
  const resolution = '1h';

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

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
            since={since}
            resolution={resolution}
            stat="events.total"
            label="Events"
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>{t('Dropped Events')}</PanelHeader>
        <PanelBody withPadding>
          <InternalStatChart
            since={since}
            resolution={resolution}
            stat="events.dropped"
            label="Events"
          />
        </PanelBody>
      </Panel>
    </Fragment>
  );
}
