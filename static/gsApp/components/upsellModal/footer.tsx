import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import type {Subscription} from 'getsentry/types';
import {getFriendlyPlanName} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

interface UpsellFooterProps {
  onCloseModal: () => void;
  organization: Organization;
  subscription: Subscription;
  showTrialResetContent?: boolean;
  source?: string;
}

function Footer({
  subscription,
  organization,
  source,
  onCloseModal,
  showTrialResetContent,
}: UpsellFooterProps) {
  const buttonProps = {
    subscription,
    organization,
    source: 'business-landing.' + (source || 'unknown'),
    onSuccess: onCloseModal,
  };

  const canTrial = subscription.canTrial && !subscription.isTrial;

  return (
    <FooterWrapper>
      <UpgradeOrTrialButton data-test-id="upgrade-or-trial" {...buttonProps} />
      {/* if the trial was reset, just show them a maybe later button */}
      {canTrial && !showTrialResetContent ? (
        <UpgradeOrTrialButton
          data-test-id="upgrade-plan"
          priority="default"
          action="upgrade"
          {...buttonProps}
        />
      ) : (
        <Button data-test-id="maybe-later" priority="default" onClick={onCloseModal}>
          {t('Maybe Later')}
        </Button>
      )}

      <SidebarFooter>
        <h1>{t('Current Plan')}</h1>
        <h2>{getFriendlyPlanName(subscription)}</h2>
        <a
          href="https://sentry.io/pricing"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            trackGetsentryAnalytics('business_landing.clicked_compare', {
              subscription,
              organization,
              source,
            });
          }}
        >
          {t('Learn more and compare plans')}
        </a>
      </SidebarFooter>
    </FooterWrapper>
  );
}

const FooterWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: flex-end;
`;

export const SidebarFooter = styled('div')`
  margin-left: auto;
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
  color: ${p => p.theme.subText};
  h1 {
    text-transform: uppercase;
    font-weight: bold;
    font-size: ${p => p.theme.fontSizeSmall};
    margin-bottom: 0.5rem;
  }
  h2 {
    font-size: ${p => p.theme.fontSizeLarge};
    font-weight: normal;
    margin-bottom: 0.5rem;
  }
`;

export default Footer;
