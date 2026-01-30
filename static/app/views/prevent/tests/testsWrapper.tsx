import {Outlet} from 'react-router-dom';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';

import NotFound from 'sentry/components/errors/notFound';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export default function TestAnalyticsPageWrapper() {
  const organization = useOrganization();

  if (!organization.features.includes('prevent-test-analytics')) {
    return <NotFound />;
  }

  return (
    <SentryDocumentTitle title={t('Test Analytics')} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex justify="between" align="center">
            <Layout.Title>
              {t('Test Analytics')}
              <FeatureBadge type="beta" />
            </Layout.Title>
            <FeedbackButton
              feedbackOptions={{
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
