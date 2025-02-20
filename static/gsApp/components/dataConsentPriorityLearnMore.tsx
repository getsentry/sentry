import {useEffect} from 'react';
import styled from '@emotion/styled';

import bannerStar from 'sentry-images/spot/banner-star.svg';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import getOrganizationAge from 'sentry/utils/getOrganizationAge';
import useOrganization from 'sentry/utils/useOrganization';

import {openDataConsentModal} from 'getsentry/actionCreators/modal';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

function DataConsentPriorityLearnMore({subscription}: {subscription?: Subscription}) {
  const organization = useOrganization();
  const hasBillingAccess = organization.access.includes('org:billing');
  const {isLoading, isError, isPromptDismissed, dismissPrompt} = usePrompt({
    feature: 'data_consent_priority',
    organization,
  });

  const organizationAge = getOrganizationAge(organization);

  const hideDataConsentBanner =
    isLoading ||
    isError ||
    isPromptDismissed ||
    organization.aggregatedDataConsent ||
    !hasBillingAccess ||
    !subscription ||
    (defined(subscription.msaUpdatedForDataConsent)
      ? !subscription.msaUpdatedForDataConsent
      : false) ||
    organizationAge < 60 ||
    organizationAge > 120;

  useEffect(() => {
    if (!hideDataConsentBanner) {
      trackGetsentryAnalytics('data_consent_priority.viewed', {organization});
    }
  }, [hideDataConsentBanner, organization]);

  if (hideDataConsentBanner) {
    return null;
  }

  return (
    <LearnMoreWrapper>
      <BannerStar1 src={bannerStar} />
      <BannerStar2 src={bannerStar} />
      <BannerStar3 src={bannerStar} />
      <p>
        <strong>{t('Want better priority?')}</strong>
      </p>
      <p>{t('Help us improve models that better predict the priority of issues.')}</p>
      <LearnMoreButton
        analyticsEventKey="data_consent_priority.learn_more"
        analyticsEventName="Data Consent Priority: Learn More"
        onClick={() => openDataConsentModal()}
        size="xs"
      >
        {t('Learn More')}
      </LearnMoreButton>
      <DismissButton
        analyticsEventKey="data_consent_priority.dismiss"
        analyticsEventName="Data Consent Priority: Dismiss"
        size="zero"
        borderless
        icon={<IconClose size="xs" />}
        aria-label={t('Dismiss')}
        onClick={() => dismissPrompt()}
      />
    </LearnMoreWrapper>
  );
}

export default withSubscription(DataConsentPriorityLearnMore);

const LearnMoreWrapper = styled('div')`
  position: relative;
  max-width: 230px;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(1.5)};
  border-top: 1px solid ${p => p.theme.innerBorder};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  overflow: hidden;
  background: linear-gradient(
    269.35deg,
    ${p => p.theme.backgroundTertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );

  p {
    margin: 0 0 ${space(0.5)} 0;
  }
`;

const DismissButton = styled(Button)`
  position: absolute;
  top: ${space(1)};
  right: ${space(1.5)};
  color: ${p => p.theme.subText};
`;

const BannerStar1 = styled('img')`
  position: absolute;
  bottom: 10px;
  right: 100px;
`;
const BannerStar2 = styled('img')`
  position: absolute;
  top: 10px;
  right: 60px;
  transform: rotate(-20deg) scale(0.8);
`;
const BannerStar3 = styled('img')`
  position: absolute;
  bottom: 30px;
  right: 20px;
  transform: rotate(60deg) scale(0.85);
`;
const LearnMoreButton = styled(Button)`
  margin-top: 2px;
`;
