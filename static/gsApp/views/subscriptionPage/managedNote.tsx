import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {tct} from 'sentry/locale';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import type {Subscription} from 'getsentry/types';
import {BillingType} from 'getsentry/types';

/**
 * Message templates for different subscription scenarios.
 * Each message includes a link to the appropriate action channel.
 */
const SALES_MESSAGE = tct(
  'Contact us at [mailto:sales@sentry.io] to make changes to your subscription.',
  {mailto: <a href="mailto:sales@sentry.io" />}
);

/**
 * Partner-specific message templates.
 * Each partner has their own marketplace or dashboard where users can manage their subscriptions.
 */
const PARTNER_MESSAGES = {
  // GitHub Marketplace message
  GH: tct(
    'Visit the [marketplace:GitHub Marketplace] to make changes to your subscription.',
    {marketplace: <a href="https://github.com/marketplace/sentry" />}
  ),
  // Heroku Dashboard message
  HK: tct(
    'Visit the [dashboard:Heroku Dashboard] to make changes to your subscription.',
    {dashboard: <a href="https://dashboard.heroku.com" />}
  ),
};

/**
 * Default message for standard subscriptions that can't self-serve.
 * Users are directed to contact support for subscription changes.
 */
const DEFAULT_MESSAGE = tct(
  'Contact us at [mailto:support@sentry.io] to make changes to your subscription.',
  {mailto: <a href="mailto:support@sentry.io" />}
);

type Props = {
  subscription: Subscription;
};

/**
 * ManagedNote Component
 *
 * This component displays guidance messages for users who cannot self-serve their subscription changes.
 * The message varies based on the subscription type and partner status:
 *
 * 1. For self-serve subscriptions: No message is displayed
 * 2. For VC marketplace subscriptions: No message is displayed (they can self-serve through billing checkout)
 * 3. For sales-managed accounts (invoiced or custom-priced): Directs to sales team
 * 4. For partner integrations (GitHub, Heroku): Directs to respective partner platforms
 * 5. For all other cases: Directs to support team
 *
 * @param {Props} props - Component props containing the subscription object
 * @returns {React.ReactNode | null} Returns null for self-serve cases, otherwise returns a Panel with guidance
 */
function ManagedNote({subscription}: Props) {
  // Early return for self-serve subscriptions
  if (subscription.canSelfServe) {
    return null;
  }

  // Special case: VC marketplace subscriptions can self-serve through billing checkout
  if (subscription.partner?.partnership?.id === 'VC') {
    // Sentry organizations provisioned through VC Marketplace (Native Integration) can self-serve
    // their subscription through the billing checkout page.
    return null;
  }

  // Determine which message to display based on subscription type and partner status
  const isSalesAccount =
    // Invoiced subscriptions are managed by sales
    subscription.type === BillingType.INVOICED ||
    // Custom-priced subscriptions (price > 0) are managed by sales
    (subscription.customPrice !== null && subscription.customPrice > 0);

  return (
    <Panel data-test-id="managed-note">
      <PanelBody withPadding>
        <TextBlock noMargin>
          {isSalesAccount
            ? // Sales-managed accounts are directed to the sales team
              SALES_MESSAGE
            : (subscription.partner &&
                // Partner accounts get partner-specific messages, others get the default support message
                // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                PARTNER_MESSAGES[subscription.partner?.partnership.id]) ??
              DEFAULT_MESSAGE}
        </TextBlock>
      </PanelBody>
    </Panel>
  );
}

export default ManagedNote;
