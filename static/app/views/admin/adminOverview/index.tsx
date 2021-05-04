import {Fragment} from 'react';
import DocumentTitle from 'react-document-title';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';

import ApiChart from './apiChart';
import EventChart from './eventChart';

const AdminOverview = () => {
  const resolution = '1h';
  const since = new Date().getTime() / 1000 - 3600 * 24 * 7;

  return (
    <DocumentTitle title="Admin Overview - Sentry">
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
    </DocumentTitle>
  );
};

export default AdminOverview;
