/**
 * OnDemandDisabled is a component that displays an error alert when on-demand billing
 * has been disabled for an organization due to unpaid invoices.
 *
 * On-demand billing can be disabled in two places:
 * 1. At the subscription level via subscription.flags.ondemand_disabled
 * 2. In the current billing history period via billinghistory.ondemand_disabled
 *
 * When disabled:
 * - The organization cannot use on-demand capacity
 * - This may impact the organization's ability to accept data into Sentry
 * - The user needs to pay outstanding invoices to re-enable on-demand billing
 *
 * Integration with billing system:
 * - The subscription.disable_ondemand() method sets both subscription flag and billing history
 * - Re-enabling requires paying outstanding invoices and calling subscription.enable_ondemand()
 *
 * Component behavior:
 * - Renders an error Alert component when conditions are met
 * - Provides links to billing receipts and support email
 * - Used in both billing overview pages (with and without billing permissions)
 *
 * @param props.subscription - The organization's subscription object containing:
 *   - onDemandDisabled: boolean indicating if on-demand billing is disabled
 *   - onDemandMaxSpend: number indicating maximum on-demand spend limit
 *   - planTier: string indicating the subscription plan tier
 */
import {NavLink} from 'react-router-dom';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';

import {PlanTier, type Subscription} from 'getsentry/types';
import {isAmPlan} from 'getsentry/utils/billing';

interface Props {
  subscription: Subscription;
}

function OnDemandDisabled({subscription}: Props) {
  // Only show the alert if billing is disabled and there's a spend limit configured
  if (!(subscription.onDemandDisabled && subscription.onDemandMaxSpend > 0)) {
    return null;
  }

  // Determine the appropriate terminology based on plan tier
  const preAM3Tiers = [PlanTier.AM1, PlanTier.AM2];
  const isPreAM3Tier = preAM3Tiers.includes(subscription.planTier as PlanTier);

  const isAMTier = isAmPlan(subscription.planTier as PlanTier);

  // Set display name based on plan tier:
  // - "Pay-as-you-go" for AM3+ plans
  // - "On-demand" for all other plans (including legacy AM1/AM2)
  let name = 'On-demand';
  if (isAMTier && !isPreAM3Tier) {
    name = 'Pay-as-you-go';
  }

  return (
    <Alert type="error" data-test-id="ondemand-disabled-alert">
      <span>
        {tct(
          "[Name] billing is disabled for your organization due to an unpaid [lowercase_name] invoice. This may impact your organization's ability to accept data into Sentry. [docs_link:Learn more about this process].",
          {
            Name: name,
            lowercase_name: name.toLowerCase(),
            docs_link: (
              <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/23622477256987-We-can-t-pay-our-on-demand-pay-as-you-go-invoice-and-have-an-annual-contract-What-happens" />
            ),
          }
        )}
      </span>{' '}
      <span>
        {tct(
          'Please pay any [receipts_link:outstanding invoices] to re-enable [lowercase_name] billing. If there are any issues, please contact us at [contact_link:support@sentry.io].',
          {
            lowercase_name: name.toLowerCase(),
            receipts_link: <NavLink to="/settings/billing/receipts/" />,
            contact_link: <a href="mailto:support@sentry.io" />,
          }
        )}
      </span>
    </Alert>
  );
}

export default OnDemandDisabled;
