import Feature from 'sentry/components/acl/feature';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {getTitleFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/title';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {MultiQueryModeContent} from 'sentry/views/explore/multiQueryMode/content';
import {SavedQueryEditMenu} from 'sentry/views/explore/savedQueryEditMenu';
import {StarSavedQueryButton} from 'sentry/views/explore/starSavedQueryButton';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export default function MultiQueryMode() {
  const location = useLocation();
  const organization = useOrganization();
  const title = getTitleFromLocation(location);

  const prefersStackedNav = usePrefersStackedNav();

  const id = getIdFromLocation(location);
  const {data: savedQuery} = useGetSavedQuery(id);

  return (
    <Feature
      features="visibility-explore-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <SentryDocumentTitle title={t('Compare Queries')} orgSlug={organization.slug}>
        <Layout.Header unified>
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
            <Layout.Title>{title ? title : t('Compare Queries')}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              {!prefersStackedNav && (
                <LinkButton
                  to={`/organizations/${organization.slug}/explore/saved-queries/`}
                  size="sm"
                >
                  {t('Saved Queries')}
                </LinkButton>
              )}
              <StarSavedQueryButton />
              {defined(id) && savedQuery?.isPrebuilt === false && <SavedQueryEditMenu />}
              <FeedbackWidgetButton />
            </ButtonBar>
          </Layout.HeaderActions>
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
