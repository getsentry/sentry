import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {
  buildInstallationMenuItems,
  NEW_INSTALL_KEY,
} from 'sentry/components/pipeline/pipelineIntegrationGitHub';
import {IconLightning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {ScmGithubMultiOrgInstallProps} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useBillingConfig} from 'getsentry/hooks/useBillingConfig';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import type {BillingConfig, Subscription} from 'getsentry/types';
import {displayPlanName} from 'getsentry/utils/billing';

export function ScmGithubMultiOrgInstall({
  installations,
  onSelectInstallation,
  onNewInstall,
  isDisabled,
  newInstallDisabled,
  popupBlockedNotice,
}: ScmGithubMultiOrgInstallProps) {
  const organization = useOrganization();
  const subscription = useSubscription();

  const hasSCMMultiOrg = organization.features.includes('integrations-scm-multi-org');
  const hasMultiOrgInstallations = installations.some(inst => (inst.count ?? 0) > 0);
  const needsUpgrade = !hasSCMMultiOrg && hasMultiOrgInstallations;

  const menuItems = buildInstallationMenuItems(installations, {newInstallDisabled}).map(
    item => {
      if (item.key === NEW_INSTALL_KEY) {
        return item;
      }
      const inst = installations.find(i => i.installationId === item.key);
      const isMultiOrg = (inst?.count ?? 0) > 0;
      return {...item, disabled: needsUpgrade && isMultiOrg};
    }
  );

  return (
    <Stack gap="lg" align="start">
      {needsUpgrade && (
        <Alert
          variant="warning"
          trailingItems={
            <LinkButton
              size="xs"
              priority="primary"
              icon={<IconLightning />}
              href={`/settings/${organization.slug}/billing/overview/?referrer=upgrade-github-multi-org`}
              external
              analyticsEventKey="github.multi_org.upsell"
              analyticsEventName="Github Multi-Org Upsell Clicked"
            >
              {t('Upgrade')}
            </LinkButton>
          }
        >
          <UpgradeMessage subscription={subscription} />
        </Alert>
      )}
      {popupBlockedNotice}
      <DropdownMenu
        triggerLabel={t('Select GitHub organization')}
        items={menuItems}
        isDisabled={isDisabled}
        onAction={key => {
          if (key === NEW_INSTALL_KEY) {
            onNewInstall();
          } else {
            onSelectInstallation(key as string);
          }
        }}
      />
    </Stack>
  );
}

function UpgradeMessage({subscription}: {subscription: Subscription | null}) {
  const organization = useOrganization();

  if (!subscription) {
    return (
      <span>
        {t(
          'Some GitHub organizations are already connected to other Sentry organizations. An upgraded plan is required to share GitHub installations across multiple Sentry organizations.'
        )}
      </span>
    );
  }

  return (
    <UpgradeMessageWithBilling organization={organization} subscription={subscription} />
  );
}

function UpgradeMessageWithBilling({
  organization,
  subscription,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const {data: billingConfig} = useBillingConfig({organization, subscription});
  const planName = getRequiredPlanName(billingConfig);

  if (planName) {
    return (
      <span>
        {tct(
          'Some GitHub organizations are already connected to other Sentry organizations. A [planName] plan or above is required to share GitHub installations across multiple Sentry organizations.',
          {planName: <strong>{planName}</strong>}
        )}
      </span>
    );
  }

  return (
    <span>
      {t(
        'Some GitHub organizations are already connected to other Sentry organizations. An upgraded plan is required to share GitHub installations across multiple Sentry organizations.'
      )}
    </span>
  );
}

function getRequiredPlanName(billingConfig: BillingConfig | undefined): string | null {
  if (!billingConfig) {
    return null;
  }

  const plan = billingConfig.planList
    .filter(p => p.userSelectable)
    .sort((a, b) => a.price - b.price)
    .find(p => p.features.includes('integrations-scm-multi-org'));

  if (!plan) {
    return null;
  }

  return displayPlanName(plan);
}
