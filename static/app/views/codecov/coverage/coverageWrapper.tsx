import {Outlet} from 'react-router-dom';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {COVERAGE_PAGE_TITLE} from 'sentry/views/codecov/settings';

export default function CoveragePageWrapper() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={COVERAGE_PAGE_TITLE} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex align="center" justify="space-between" direction="row">
            <Layout.Title>
              {COVERAGE_PAGE_TITLE}
              <FeatureBadge type="new" />
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
