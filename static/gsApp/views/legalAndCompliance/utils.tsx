import {ExternalLink} from '@sentry/scraps/link';

import {PanelItem} from 'sentry/components/panels/panelItem';
import {tct} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';

import {SubscriptionLoadingFallback} from 'getsentry/components/subscriptionLoadingFallback';
import {useSubscription} from 'getsentry/hooks/useSubscription';

export function DataConsentSettingsHeader() {
  const subscription = useSubscription();

  if (!subscription) {
    return <SubscriptionLoadingFallback />;
  }

  if (defined(subscription.msaUpdatedForDataConsent)) {
    return null;
  }
  return (
    <PanelItem key="tos-non-identifying">
      <p>
        {tct(
          'In accordance with our [link:Terms of Service], Sentry may use non-identifying elements of your service data for product improvement.',
          {link: <ExternalLink href="https://sentry.io/terms/" />}
        )}
      </p>
    </PanelItem>
  );
}
