import {Button} from '@sentry/scraps/button';

import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

function Header() {
  const openFeedbackForm = useFeedbackForm();

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
      {openFeedbackForm ? (
        <Layout.HeaderActions>
          <Button
            size="sm"
            icon={<IconMegaphone />}
            onClick={() =>
              openFeedbackForm({
                messagePlaceholder: t('How can we improve the Releases experience?'),
                tags: {
                  ['feedback.source']: 'releases-list-header',
                },
              })
            }
          >
            {t('Give Feedback')}
          </Button>
        </Layout.HeaderActions>
      ) : null}
    </Layout.Header>
  );
}

export default Header;
