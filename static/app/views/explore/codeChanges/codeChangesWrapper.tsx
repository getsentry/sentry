import {Outlet, useLocation} from 'react-router-dom';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';

const CODE_CHANGES_PAGE_TITLE = 'Code Changes';

export default function CodeChangesPageWrapper() {
  const organization = useOrganization();
  const location = useLocation();

  const isDetailPage = location.pathname.match(/\/code-changes\/[^/]+\/?$/);

  if (!organization) {
    return <div style={{padding: '20px'}}>Loading organization...</div>;
  }

  // Detail page manages its own title and layout
  if (isDetailPage) {
    return <Outlet />;
  }

  // List page gets the wrapper's title and layout
  return (
    <SentryDocumentTitle title={CODE_CHANGES_PAGE_TITLE} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex align="center" justify="between" direction="row">
            <Layout.Title>
              {CODE_CHANGES_PAGE_TITLE}
              <FeatureBadge type="new" />
            </Layout.Title>
          </Flex>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main width="full">
          <Outlet />
        </Layout.Main>
      </Layout.Body>
    </SentryDocumentTitle>
  );
}
