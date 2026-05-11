import {Stack} from '@sentry/scraps/layout';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SavedQueriesLandingContent} from 'sentry/views/explore/savedQueries/savedQueriesLandingContent';
import {TopBar} from 'sentry/views/navigation/topBar';

export default function SavedQueriesView() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('All Queries')} orgSlug={organization?.slug}>
      <Stack flex={1}>
        <TopBar.Slot name="title">{t('All Queries')}</TopBar.Slot>
        <TopBar.Slot name="feedback">
          <FeedbackButton
            aria-label={t('Give Feedback')}
            tooltipProps={{title: t('Give Feedback')}}
          >
            {null}
          </FeedbackButton>
        </TopBar.Slot>

        <Layout.Body>
          <Layout.Main width="full">
            <SavedQueriesLandingContent />
          </Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}
