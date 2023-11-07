import {CSSProperties} from 'react';
import styled from '@emotion/styled';

import replaysDeadRageBackground from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import {LinkButton} from 'sentry/components/button';
import {useHasOrganizationSetupFeedback} from 'sentry/components/feedback/useFeedbackOnboarding';
import PageBanner from 'sentry/components/replays/pageBanner';
import {IconBroadcast} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import useDismissAlert from 'sentry/utils/useDismissAlert';

interface Props {
  style?: CSSProperties;
}

const LOCAL_STORAGE_KEY = 'feedback-set-up-alert-dismissed';

export default function FeedbackSetupBanner({style}: Props) {
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});
  const {hasOrgSetupFeedback} = useHasOrganizationSetupFeedback();

  const docsButton = (
    <LinkButton
      external
      href="https://github.com/getsentry/sentry-javascript/blob/develop/packages/feedback/README.md"
      priority="primary"
    >
      {t('Set Up Now')}
    </LinkButton>
  );

  return isDismissed || hasOrgSetupFeedback ? null : (
    <PageBanner
      style={style}
      button={docsButton}
      description={t(
        "Users can submit feedback anytime on issues they're experiencing on your app via our feedback widget."
      )}
      heading={t('Introducing the New User Feedback')}
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
