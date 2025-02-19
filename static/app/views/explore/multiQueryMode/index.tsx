import Feature from 'sentry/components/acl/feature';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {MultiQueryModeContent} from 'sentry/views/explore/multiQueryMode/content';
import {generateTracesRoute} from 'sentry/views/traces/utils';

export default function MultiQueryMode() {
  const organization = useOrganization();

  return (
    <Feature
      features="explore-multi-query"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <SentryDocumentTitle title={t('Compare')} orgSlug={organization.slug}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: t('Explore'),
                  to: generateTracesRoute({orgSlug: organization.slug}),
                },
                {
                  label: t('Compare'),
                },
              ]}
            />
            <Layout.Title>{t('Compare')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Page>
          <PageFiltersContainer>
            <MultiQueryModeContent />
          </PageFiltersContainer>
        </Layout.Page>
      </SentryDocumentTitle>
    </Feature>
  );
}
