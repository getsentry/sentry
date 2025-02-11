import styled from '@emotion/styled';

import businessUpgrade from 'getsentry-images/product_trial/business-upgrade-notrial.svg';
import businessTrial from 'getsentry-images/product_trial/try-sentry-business-present.svg';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import {usePlanMigrations} from 'getsentry/hooks/usePlanMigrations';
import type {Subscription} from 'getsentry/types';
import {hasPerformance, isBizPlanFamily} from 'getsentry/utils/billing';
import TrialBadge from 'getsentry/views/subscriptionPage/trial/badge';

const getSubscriptionBannerText = (
  organization: Organization,
  subscription: Subscription
): [headerText: React.ReactNode, subText: React.ReactNode] => {
  const hasBillingPerms = organization.access?.includes('org:billing');

  const featuresName = hasPerformance(subscription.planDetails)
    ? 'Business plan'
    : 'Performance';
  // upsell a trial if available
  if (subscription.canTrial) {
    if (hasBillingPerms) {
      return [
        hasPerformance(subscription.planDetails)
          ? t('Try Sentry Business for Free')
          : t('Try Performance for Free'),
        tct(
          `Activate your trial to take advantage of Sentry's [featuresName] features.`,
          {featuresName}
        ),
      ];
    }
    return [
      hasPerformance(subscription.planDetails)
        ? t('Request a Free Sentry Business Trial')
        : t('Request a Free Sentry Performance Trial'),
      tct(
        '[italicized] your Organization’s owner to start a [featuresName] trial (See what I did there?).',
        {
          italicized: <i>{t('Bug')}</i>,
          featuresName,
        }
      ),
    ];
  }
  // if on free plan, we need to get to a paid plan
  return hasBillingPerms
    ? [
        t('Upgrade to Business'),
        t(
          'Advanced integrations, deep insights, custom dashboards, and more. Upgrade to Sentry’s Business plan today.'
        ),
      ]
    : [
        t('Request an Upgrade to Business'),
        tct(
          '[italicized] your Organization’s owner to upgrade Sentry (See what I did there?).',
          {
            italicized: <i>{t('Bug')}</i>,
          }
        ),
      ];
};

function useIsSubscriptionUpsellHidden(
  subscription: Subscription,
  organization: Organization
): boolean {
  const {planMigrations, isLoading} = usePlanMigrations();
  // Hide while loading
  if (isLoading) {
    return true;
  }

  // hide upsell for mmx plans and forced plan migrations
  const isLegacyUpsell =
    (!hasPerformance(subscription.planDetails) || planMigrations.length > 0) &&
    !subscription.canTrial;

  // hide upsell for customers on partner plans with flag
  const hasPartnerMigrationFeature = organization.features.includes(
    'partner-billing-migration'
  );

  // exclude current tiers business, non-self serve, current trial orgs, legacy upsells, and orgs with pending business upgrade
  if (
    !subscription.canSelfServe ||
    (hasPerformance(subscription.planDetails) &&
      isBizPlanFamily(subscription.planDetails)) ||
    subscription.isTrial ||
    isLegacyUpsell ||
    hasPartnerMigrationFeature ||
    isBizPlanFamily(subscription.pendingChanges?.planDetails)
  ) {
    return true;
  }

  return false;
}

const BANNER_PROMPT_KEY = 'subscription_try_business_banner';

interface SubscriptionUpsellBannerProps {
  organization: Organization;
  subscription: Subscription;
}

export function SubscriptionUpsellBanner({
  organization,
  subscription,
}: SubscriptionUpsellBannerProps) {
  const isHidden = useIsSubscriptionUpsellHidden(subscription, organization);
  const {isLoading, isError, isPromptDismissed, dismissPrompt} = usePrompt({
    feature: BANNER_PROMPT_KEY,
    organization,
    options: {enabled: !isHidden},
  });

  if (isHidden || isPromptDismissed || isLoading || isError) {
    return null;
  }

  const [title, description] = getSubscriptionBannerText(organization, subscription);

  return (
    <BusinessTrialBannerWrapper>
      <div>
        <IntegationBannerTitle>
          {title}
          {subscription.canTrial && (
            <TrialBadge subscription={subscription} organization={organization} />
          )}
        </IntegationBannerTitle>
        <IntegationBannerDescription>
          {description}{' '}
          <Button
            size="zero"
            priority="link"
            onClick={() =>
              openUpsellModal({organization, source: 'subscription_overview'})
            }
          >
            {t('Learn More')}
          </Button>
        </IntegationBannerDescription>
        <UpgradeOrTrialButton
          subscription={subscription}
          organization={organization}
          source="subscription-overview"
          size="sm"
        >
          {({hasBillingAccess, action}) => {
            // overide the CTA for starting a trial
            if (hasBillingAccess && action === 'trial') {
              return t('Start Trial');
            }
            return null;
          }}
        </UpgradeOrTrialButton>
      </div>
      <BannerImage src={subscription.canTrial ? businessTrial : businessUpgrade} />
      <CloseBannerButton
        borderless
        priority="link"
        aria-label={t('Dismiss')}
        icon={<IconClose color="subText" />}
        size="xs"
        onClick={dismissPrompt}
      />
    </BusinessTrialBannerWrapper>
  );
}

const BusinessTrialBannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
  margin: ${space(1)} 0;
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
  margin-bottom: 24px;
`;

const IntegationBannerTitle = styled('div')`
  display: flex;
  align-items: baseline;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
  font-weight: 600;
`;

const IntegationBannerDescription = styled('div')`
  margin-bottom: ${space(1.5)};
  max-width: 440px;
`;

const CloseBannerButton = styled(Button)`
  position: absolute;
  display: block;
  top: ${space(2)};
  right: ${space(2)};
  color: ${p => p.theme.white};
  cursor: pointer;
  z-index: 1;
`;

const BannerImage = styled('img')`
  position: absolute;
  display: none;
  bottom: 0px;
  right: 4rem;
  pointer-events: none;
  max-height: 90%;

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    display: block;
  }
`;
