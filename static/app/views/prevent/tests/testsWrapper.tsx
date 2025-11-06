import {Outlet} from 'react-router-dom';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Flex} from 'sentry/components/core/layout';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {TESTS_PAGE_TITLE} from 'sentry/views/prevent/settings';

export default function TestAnalyticsPageWrapper() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={TESTS_PAGE_TITLE} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex align="center" justify="between" direction="row">
            <Layout.Title>
              {TESTS_PAGE_TITLE}
              <FeatureBadge type="beta" />
            </Layout.Title>
            <FeedbackWidgetButton
              optionOverrides={{
                tags: {
                  'feedback.source': 'prevent.tests',
                  'feedback.owner': 'prevent-team',
                },
              }}
            />
          </Flex>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <PreventQueryParamsProvider>
          <Layout.Main width="full">
            <Outlet />
          </Layout.Main>
        </PreventQueryParamsProvider>
      </Layout.Body>
    </SentryDocumentTitle>
  );
}
