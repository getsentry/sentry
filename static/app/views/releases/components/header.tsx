import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';

export default function Header() {
  return (
    <Layout.Header noActionWrap unified>
      <Layout.HeaderContent unified>
        <Layout.Title>
          {t('Releases')}
          <PageHeadingQuestionTooltip
            docsUrl="https://docs.sentry.io/product/releases/"
            title={t(
              'A visualization of your release adoption from the past 24 hours, providing a high-level view of the adoption stage, percentage of crash-free users and sessions, and more.'
            )}
          />
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <FeedbackButton
          feedbackOptions={{
            messagePlaceholder: t('How can we improve the Releases experience?'),
            tags: {
              ['feedback.source']: 'releases-list-header',
            },
          }}
        />
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
