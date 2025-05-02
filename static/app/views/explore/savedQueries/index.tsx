import {LinkButton} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {SavedQueriesLandingContent} from 'sentry/views/explore/savedQueries/savedQueriesLandingContent';

export default function SavedQueriesView() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('All Queries')} orgSlug={organization?.slug}>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('All Queries')}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <FeedbackWidgetButton />
              <LinkButton
                priority="primary"
                icon={<IconAdd />}
                size="sm"
                to={`/organizations/${organization.slug}/explore/traces/`}
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
