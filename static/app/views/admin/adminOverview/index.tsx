import {Fragment} from 'react';

import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';

import ApiChart from './apiChart';
import EventChart from './eventChart';

const AdminOverview = () => {
  const resolution = '1h';
  const since = new Date().getTime() / 1000 - 3600 * 24 * 7;

  return (
    <SentryDocumentTitle title={t('Admin Overview')}>
      <Fragment>
        <h3>{t('System Overview')}</h3>

        <Panel key="events">
          <PanelHeader>{t('Event Throughput')}</PanelHeader>
          <PanelBody withPadding>
            <EventChart since={since} resolution={resolution} />
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
};

export default AdminOverview;
