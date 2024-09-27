import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';

function BackendOverviewPage() {
  return (
    <Fragment>
      <Layout.Header>
        <BackendHeader />
      </Layout.Header>
      <Layout.Main fullWidth>
        <PageAlert />
        {'overview page'}
      </Layout.Main>
    </Fragment>
  );
}

export default BackendOverviewPage;
