import {useState} from 'react';

import type {Client} from 'sentry/api';
import type {ButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import withApi from 'sentry/utils/withApi';

import {sendTrialRequest, sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import StartTrialButton from 'getsentry/components/startTrialButton';
import type {Subscription} from 'getsentry/types';
import {getTrialLength} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type ChildRenderProps = {
  action: 'upgrade' | 'trial';
  hasBillingAccess: boolean;
};

type ChildRenderFunction = (options: ChildRenderProps) => React.ReactNode;

type Props = {
  api: Client;
  organization: Organization;
  source: string;
  subscription: Subscription;
  action?: 'upgrade' | 'trial';
  children?: React.ReactNode | ChildRenderFunction;
  onSuccess?: () => void;
  requestData?: Record<string, unknown>;
  /**
   * Default button priority to use when the button triggers an upgrade
   */
  trialPriority?: ButtonProps['priority'];
  /**
   * Default button priority to use when the button will start a trial
   */
  upgradePriority?: ButtonProps['priority'];
} & Omit<React.ComponentProps<typeof Button>, 'to' | 'onClick' | 'busy' | 'children'>;

/**
 * This button has the following modes:
 * 1. Start trial (admins with trial available)
 * 2. Go to checkout page
 * 3. Request trial (if trial available but no permissions)
 * 4. Request upgrade
 */
function UpgradeOrTrialButton({
  source,
  organization,
  subscription,
  onSuccess,
  action: _action,
  api,
  children,
  requestData,
  upgradePriority = 'primary',
  trialPriority = 'primary',
  ...props
}: Props) {
  const {slug} = organization;
  const hasAccess = organization.access.includes('org:billing');

  // can override action if we want
  const action =
    _action ?? (subscription.canTrial && !subscription.isTrial ? 'trial' : 'upgrade');

  const childComponent =
    typeof children === 'function'
      ? children({action, hasBillingAccess: hasAccess})
      : children;

  // The button color depends on the priority, and that is determined by the action
  const buttonPriority: ButtonProps['priority'] =
    action === 'trial' ? trialPriority : upgradePriority;

  const recordAnalytics = () => {
    const getVerb = () => {
      if (!hasAccess) {
        return 'requested';
      }
      // need a different verb for upgrades since it's just a link
      return action === 'upgrade' ? 'link_clicked' : 'started';
    };
    trackGetsentryAnalytics('growth.upgrade_or_trial.clicked', {
      action: `${action}.${getVerb()}`,
      source,
      organization,
      subscription,
    });
  };

  const handleSuccess = () => {
    recordAnalytics();
    onSuccess?.();
  };

  const [busy, setBusy] = useState(false);

  const handleRequest = async () => {
    setBusy(true);
    const args = {
      api,
      organization,
      handleSuccess,
    };
    if (action === 'trial') {
      await sendTrialRequest(args);
    } else {
      await sendUpgradeRequest(args);
    }
    setBusy(false);
  };

  // we don't want non-self serve customers to see request to trial/upgrade CTAs
  if (!hasAccess && !subscription.canSelfServe) {
    return null;
  }

  if (action === 'trial') {
    if (hasAccess) {
      // admin with trial available
      return (
        <StartTrialButton
          organization={organization}
          source={source}
          onTrialStarted={handleSuccess}
          requestData={requestData}
          priority={buttonPriority}
          {...props}
        >
          {childComponent || t('Start %s-Day Trial', getTrialLength(organization))}
        </StartTrialButton>
      );
    }
    // non-admin who wants to trial
    return (
      <Button onClick={handleRequest} busy={busy} priority={buttonPriority} {...props}>
        {childComponent || t('Request Trial')}
      </Button>
    );
  }

  if (hasAccess) {
    // send self-serve directly to checkout
    const baseUrl = subscription.canSelfServe
      ? `/settings/${slug}/billing/checkout/`
      : `/settings/${slug}/billing/overview/`;

    return (
      <Button
        onClick={handleSuccess}
        to={`${baseUrl}?referrer=upgrade-${source}`}
        priority={buttonPriority}
        {...props}
      >
        {childComponent || t('Upgrade now')}
      </Button>
    );
  }
  return (
    <Button onClick={handleRequest} busy={busy} priority={buttonPriority} {...props}>
      {childComponent || t('Request Upgrade')}
    </Button>
  );
}
export default withApi(UpgradeOrTrialButton);
