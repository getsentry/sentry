import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {PageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {useFilters} from 'sentry/views/insights/pages/useFilters';
import type {ModuleName} from 'sentry/views/insights/types';

function FrontendLandingPage() {
  const filters = useFilters();

  return (
    <Fragment>
      <Layout.Header>
        <FrontendHeader module={filters.module as ModuleName} />
      </Layout.Header>
      <Layout.Main fullWidth>
        <PageAlert />
        {'overview page'}
      </Layout.Main>
    </Fragment>
  );
}

export default FrontendLandingPage;
