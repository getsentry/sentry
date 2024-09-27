import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';

function MobileOverviewPage() {
  return (
    <Fragment>
      <Layout.Header>
        <MobileHeader />
      </Layout.Header>
      <Layout.Main fullWidth>
        <PageAlert />
        {'overview page'}
      </Layout.Main>
    </Fragment>
  );
}

export default MobileOverviewPage;
