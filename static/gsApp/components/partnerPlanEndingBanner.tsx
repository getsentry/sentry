import styled from '@emotion/styled';
import PartnerPlanEndingBackground from 'getsentry-images/partnership/plan-ending.svg';

import Tag from 'sentry/components/badge/tag';
import {LinkButton} from 'sentry/components/button';
import {IconClock} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import {getContractDaysLeft, isTeamPlanFamily} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

function PartnerPlanEndingBanner({
  subscription,
  organization,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const daysLeft = getContractDaysLeft(subscription);
  const hasPendingUpgrade =
    subscription.pendingChanges !== null &&
    subscription.pendingChanges?.planDetails.price > 0;
  if (
    hasPendingUpgrade ||
    !subscription.partner ||
    !organization.features.includes('partner-billing-migration') ||
    daysLeft > 30 ||
    daysLeft < 0
  ) {
    return null;
  }

  const handleAnalytics = () => {
    trackGetsentryAnalytics('partner_billing_migration.banner.clicked_cta', {
      subscription,
      organization,
      daysLeft,
      partner: subscription.partner?.partnership.id,
    });
  };

  const partnerPlanName = subscription.partner?.partnership.displayName;
  const planToUpgradeTo = isTeamPlanFamily(subscription.planDetails)
    ? 'Team'
    : 'Business';

  return (
    <PartnerPlanEndingBannerWrapper data-test-id="partner-plan-ending-banner">
      <div>
        <PartnerPlanEndingText>
          <PartnerPlanEndingBannerTitle>
            {t('Your current promotional plan is ending')}
            <DaysLeftTag type="error" icon={<IconClock size="xs" />}>
              {tn('%s day left', '%s days left', daysLeft)}
            </DaysLeftTag>
          </PartnerPlanEndingBannerTitle>
          <div>
            {t(
              'Your one year promotional plan with Sentry and %s is ending. Upgrade to a Sentry billing plan today to continue to enjoy all the Sentry goodness.',
              partnerPlanName
            )}
          </div>
          <LinkButton
            priority="primary"
            analyticsEventKey="partner_plan_ending_banner.manage_subscription"
            analyticsEventName="Partner Plan Ending Banner: Manage Subscription"
            size="md"
            onClick={() => handleAnalytics()}
            to={`/settings/${organization.slug}/billing/checkout/?referrer=partner_plan_ending_banner`}
          >
            {t('Upgrade to %s', planToUpgradeTo)}
          </LinkButton>
        </PartnerPlanEndingText>
      </div>
      <IllustrationContainer src={PartnerPlanEndingBackground} />
    </PartnerPlanEndingBannerWrapper>
  );
}

const PartnerPlanEndingBannerWrapper = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  margin-bottom: ${space(2)};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PartnerPlanEndingText = styled('div')`
  padding: ${space(2)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  align-items: flex-start;
`;

const PartnerPlanEndingBannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: 600;
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const DaysLeftTag = styled(Tag)`
  font-weight: 400;
`;

const IllustrationContainer = styled('img')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    display: block;
    border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
    pointer-events: none;
    flex-grow: 1;
  }
`;

export default PartnerPlanEndingBanner;
