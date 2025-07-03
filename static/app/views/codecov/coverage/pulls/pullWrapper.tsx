import {Outlet} from 'react-router-dom';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';

export default function PullDetailWrapper() {
  const organization = useOrganization();

  return (
    // TODO: Update title to be some form of Pull + ID
    <SentryDocumentTitle title="Pull Page Wrapper" orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex align="center" justify="space-between" direction="row">
            <Layout.Title>
              Pull Page Wrapper <FeatureBadge type="new" />
            </Layout.Title>
          </Flex>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <Outlet />
        </Layout.Main>
      </Layout.Body>
    </SentryDocumentTitle>
  );
}
