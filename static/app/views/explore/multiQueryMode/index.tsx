import Feature from 'sentry/components/acl/feature';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getTitleFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/title';
import {MultiQueryModeContent} from 'sentry/views/explore/multiQueryMode/content';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export default function MultiQueryMode() {
  const location = useLocation();
  const organization = useOrganization();
  const title = getTitleFromLocation(location);

  const hasSavedQueries = organization.features.includes('performance-saved-queries');

  return (
    <Feature
      features="explore-multi-query"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <SentryDocumentTitle title={t('Compare Queries')} orgSlug={organization.slug}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: t('Explore'),
                },
                {
                  label: t('Traces'),
                  to: makeTracesPathname({
                    organization,
                    path: '/',
                  }),
                },
                {
                  label: t('Compare Queries'),
                },
              ]}
            />
            <Layout.Title>
              {hasSavedQueries && title ? title : t('Compare Queries')}
            </Layout.Title>
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
