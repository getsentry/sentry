import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {SavedQueriesLandingContent} from 'sentry/views/explore/savedQueries/savedQueriesLandingContent';
import {getExploreUrl} from 'sentry/views/explore/utils';

export default function SavedQueriesView() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('All Queries')} orgSlug={organization?.slug}>
      <Layout.Page>
        <Layout.Header unified>
          <Layout.HeaderContent>
            <Layout.Title>{t('All Queries')}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap="md">
              <FeedbackWidgetButton />
              <LinkButton
                priority="primary"
                icon={<IconAdd />}
                size="sm"
                to={getExploreUrl({organization, visualize: []})}
              >
                {t('Create Query')}
              </LinkButton>
            </ButtonBar>
          </Layout.HeaderActions>
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
