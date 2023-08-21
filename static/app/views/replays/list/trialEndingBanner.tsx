import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import trialEndedImage from 'sentry-images/spot/replay-inapp-trial-ended.svg';
import trialEndingImage from 'sentry-images/spot/replay-inapp-trial-ending.svg';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import PageBanner from 'sentry/components/replays/pageBanner';
import {IconClock} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface Props {
  trialEndDate: Date;
}

export default function TrialEndingBanner({trialEndDate}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const today = new Date();
  const isEnded = trialEndDate < today;

  const {dismiss, isDismissed} = useDismissAlert({
    key: isEnded
      ? `${organization.id}:replay-inapp-trial-ended-banner`
      : `${organization.id}:replay-inapp-trial-ending-banner`,
    expirationDays: 1,
  });

  if (isDismissed) {
    return null;
  }

  const handleTryNow = () => {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        query: 'click.tag:button',
      },
    });
    dismiss();
  };

  const daysLeft = isEnded
    ? 0
    : Math.ceil((trialEndDate.getTime() - today.getTime()) / MS_PER_DAY);

  return isEnded ? (
    <BannerIsEnded onDismiss={dismiss} onUpdatePlan={handleTryNow} />
  ) : (
    <BannerIsEnding daysLeft={daysLeft} onDismiss={dismiss} onUpdatePlan={handleTryNow} />
  );
}

function BannerIsEnding({
  daysLeft,
  onDismiss,
  onUpdatePlan,
}: {
  daysLeft: number;
  onDismiss: () => void;
  onUpdatePlan: () => void;
}) {
  const heading = tct('You Session Replay trial [ends]', {
    ends: (
      <YellowText>
        {tct('ends in [daysLeft] days', {
          daysLeft,
        })}
      </YellowText>
    ),
  });
  const description = tct(
    `Keep using [sessionReplay] after the trial by updating to the latest version of your plan.`,
    {
      sessionReplay: (
        <ExternalLink href="https://docs.sentry.io/product/session-replay/">
          {t('Session Replay')}
        </ExternalLink>
      ),
    }
  );
  const button = (
    <Button priority="primary" onClick={onUpdatePlan}>
      {t('Update Plan')}
    </Button>
  );

  return (
    <PageBanner
      button={button}
      description={description}
      heading={heading}
      icon={<IconClock color="yellow400" />}
      image={trialEndingImage}
      onDismiss={onDismiss}
      title={<YellowText>{t('Session Replay Trial')}</YellowText>}
    />
  );
}

function BannerIsEnded({
  onDismiss,
  onUpdatePlan,
}: {
  onDismiss: () => void;
  onUpdatePlan: () => void;
}) {
  const heading = tct('You Session Replay trial [hasEnded]', {
    hasEnded: <RedText>{t('has ended')}</RedText>,
  });
  const description = tct(
    `Keep using [sessionReplay] by updating to the latest version of your plan.`,
    {
      sessionReplay: (
        <ExternalLink href="https://docs.sentry.io/product/session-replay/">
          {t('Session Replay')}
        </ExternalLink>
      ),
    }
  );
  const button = (
    <Button priority="primary" onClick={onUpdatePlan}>
      {t('Update Plan')}
    </Button>
  );

  return (
    <PageBanner
      button={button}
      description={description}
      heading={heading}
      icon={<IconClock color="red400" />}
      image={trialEndedImage}
      onDismiss={onDismiss}
      title={<RedText>{t('Session Replay Trial')}</RedText>}
    />
  );
}

const YellowText = styled('span')`
  color: ${p => p.theme.yellow400};
`;

const RedText = styled('span')`
  color: ${p => p.theme.red400};
`;
