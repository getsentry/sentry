import Breadcrumbs from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {SavedQueriesLandingContent} from 'sentry/views/explore/savedQueries/savedQueriesLandingContent';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export default function SavedQueriesView() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('All Queries')} orgSlug={organization?.slug}>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: t('Explore'),
                  to: makeTracesPathname({organization, path: '/'}),
                },
                {
                  label: t('All Queries'),
                  to: `/organizations/${organization.slug}/explore/saved-queries/`,
                },
              ]}
            />
            <Layout.Title>{t('All Queries')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <SavedQueriesLandingContent />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
