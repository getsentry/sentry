import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {AiHeader} from 'sentry/views/insights/pages/ai/aiPageHeader';

function AiOverviewPage() {
  return (
    <Fragment>
      <Layout.Header>
        <AiHeader />
      </Layout.Header>
      <Layout.Main fullWidth>
        <PageAlert />
        {'overview page'}
      </Layout.Main>
    </Fragment>
  );
}

export default AiOverviewPage;
