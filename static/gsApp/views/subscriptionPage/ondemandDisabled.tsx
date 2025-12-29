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

import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import {tct} from 'sentry/locale';

import {type Subscription} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';

interface Props {
  subscription: Subscription;
}

function OnDemandDisabled({subscription}: Props) {
  // Only show the alert if billing is disabled and there's a spend limit configured
  if (!(subscription.onDemandDisabled && subscription.onDemandMaxSpend > 0)) {
    return null;
  }

  return (
    <Alert type="danger" data-test-id="ondemand-disabled-alert" showIcon={false}>
      <span>
        {tct(
          "[budgetTerm] billing is disabled for your organization due to an unpaid [lowerCaseBudgetTerm] invoice. This may impact your organization's ability to accept data into Sentry. [docs_link:Learn more about this process].",
          {
            budgetTerm: displayBudgetName(subscription.planDetails, {title: true}),
            lowerCaseBudgetTerm: displayBudgetName(subscription.planDetails),
            docs_link: (
              <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/23622477256987-We-can-t-pay-our-on-demand-pay-as-you-go-invoice-and-have-an-annual-contract-What-happens" />
            ),
          }
        )}
      </span>{' '}
      <span>
        {tct(
          'Please contact [contact_link:support@sentry.io] to pay [receipts_link:closed/outstanding invoices] to re-enable [budgetTerm] billing.',
          {
            budgetTerm: displayBudgetName(subscription.planDetails),
            receipts_link: <NavLink to="/settings/billing/receipts/" />,
            contact_link: <a href="mailto:support@sentry.io" />,
          }
        )}
      </span>
    </Alert>
  );
}

export default OnDemandDisabled;
