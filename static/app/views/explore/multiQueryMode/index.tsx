import Feature from 'sentry/components/acl/feature';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
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
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export default function MultiQueryMode() {
  const location = useLocation();
  const organization = useOrganization();
  const title = getTitleFromLocation(location);

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
            <ButtonBar>
              <StarSavedQueryButton />
              {defined(id) && savedQuery?.isPrebuilt === false && <SavedQueryEditMenu />}
              <FeedbackButton />
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Page>
          <MultiQueryModeContent />
        </Layout.Page>
      </SentryDocumentTitle>
    </Feature>
  );
}
