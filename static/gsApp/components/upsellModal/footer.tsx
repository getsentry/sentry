import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
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
    <Flex align="end" gap="md">
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
    </Flex>
  );
}

const SidebarFooter = styled('div')`
  margin-left: auto;
  font-size: ${p => p.theme.fontSize.md};
  white-space: nowrap;
  color: ${p => p.theme.tokens.content.secondary};
  h1 {
    text-transform: uppercase;
    font-weight: bold;
    font-size: ${p => p.theme.fontSize.sm};
    margin-bottom: 0.5rem;
  }
  h2 {
    font-size: ${p => p.theme.fontSize.lg};
    font-weight: normal;
    margin-bottom: 0.5rem;
  }
`;

export default Footer;
