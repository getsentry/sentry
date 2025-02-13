import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';

import ApiChart from './apiChart';
import EventChart from './eventChart';

function AdminOverview() {
  const theme = useTheme();

  const resolution = '1h';
  const since = new Date().getTime() / 1000 - 3600 * 24 * 7;

  return (
    <SentryDocumentTitle title={t('Admin Overview')}>
      <Fragment>
        <h3>{t('System Overview')}</h3>

        <Panel key="events">
          <PanelHeader>{t('Event Throughput')}</PanelHeader>
          <PanelBody withPadding>
            <EventChart since={since} resolution={resolution} theme={theme} />
          </PanelBody>
        </Panel>

        <Panel key="api">
          <PanelHeader>{t('API Responses')}</PanelHeader>
          <PanelBody withPadding>
            <ApiChart since={since} resolution={resolution} />
          </PanelBody>
        </Panel>
      </Fragment>
    </SentryDocumentTitle>
  );
}

export default AdminOverview;
