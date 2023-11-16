import styled from '@emotion/styled';

import replaysDeadRageBackground from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import {LinkButton} from 'sentry/components/button';
import PageBanner from 'sentry/components/replays/pageBanner';
import {IconBroadcast} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import useDismissAlert from 'sentry/utils/useDismissAlert';

const LOCAL_STORAGE_KEY = 'release-v1-feedback-dismissed';

/**
 * Copied from static/app/components/feedback/feedbackSetupBanner.tsx
 */
export default function ReleaseFeedbackBanner() {
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});

  const ctaButton = (
    <LinkButton external href="mailto:feedback-releases@sentry.io" priority="primary">
      {t('Email Us')}
    </LinkButton>
  );

  return isDismissed ? null : (
    <PageBanner
      style={{marginBottom: '16px'}}
      button={ctaButton}
      description={t('Join our beta by dropping us a note.')}
      heading={t('Want to automate rollback for bad canary releases?')}
      icon={<IconBroadcast size="sm" />}
      image={replaysDeadRageBackground}
      title={tct("[blue:What's New]", {blue: <Blue />})}
      onDismiss={dismiss}
    />
  );
}

const Blue = styled('span')`
  color: ${p => p.theme.blue400};
  font-weight: bold;
`;
