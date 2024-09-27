import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';

function FrontendOverviewPage() {
  return (
    <Fragment>
      <Layout.Header>
        <FrontendHeader />
      </Layout.Header>
      <Layout.Main fullWidth>
        <PageAlert />
        {'overview page'}
      </Layout.Main>
    </Fragment>
  );
}

export default FrontendOverviewPage;
