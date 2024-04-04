import React from 'react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FeatureBadge from 'sentry/components/featureBadge';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {RELEASE_LEVEL} from 'sentry/views/performance/cache/settings';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';

export function CacheLandingPage() {
  const organization = useOrganization();

  return (
    <React.Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: t('Performance'),
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: t('Cache'),
              },
            ]}
          />

          <Layout.Title>
            {t('Cache')}
            <FeatureBadge type={RELEASE_LEVEL} />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <FloatingFeedbackWidget />

          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <div>TEST</div>
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </React.Fragment>
  );
}

function LandingPageWithProviders() {
  return (
    <ModulePageProviders
      title={[t('Performance'), t('Cache')].join(' — ')}
      baseURL="/performance/cache"
      features="performance-cache-view"
    >
      <CacheLandingPage />
    </ModulePageProviders>
  );
}

export default LandingPageWithProviders;
