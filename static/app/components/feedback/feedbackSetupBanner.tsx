import {CSSProperties} from 'react';

import replaysDeadRageBackground from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import {LinkButton} from 'sentry/components/button';
import PageBanner from 'sentry/components/replays/pageBanner';
import {IconBroadcast} from 'sentry/icons';
import useDismissAlert from 'sentry/utils/useDismissAlert';

interface Props {
  style?: CSSProperties;
}

const LOCAL_STORAGE_KEY = 'feedback-set-up-alert-dismissed';

export default function FeedbackSetupBanner({style}: Props) {
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});

  const docsButton = (
    <LinkButton
      external
      href="https://github.com/getsentry/sentry-javascript/blob/develop/packages/feedback/README.md"
      priority="primary"
    >
      Set Up Now
    </LinkButton>
  );

  return isDismissed ? null : (
    <PageBanner
      style={style}
      button={docsButton}
      description={t('Set up our feedback widget on your site to receive reports from your users.')}
      heading={t('Introducing the New User Feedback')}
      icon={<IconBroadcast size="sm" />}
      image={replaysDeadRageBackground}
      title={t('User Feedback')}
      onDismiss={dismiss}
    />
  );
}
