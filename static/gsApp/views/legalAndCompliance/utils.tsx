import ExternalLink from 'sentry/components/links/externalLink';
import PanelItem from 'sentry/components/panels/panelItem';
import {tct} from 'sentry/locale';
import {defined} from 'sentry/utils';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';

function DataConsentHeader({subscription}: {subscription: Subscription}) {
  if (defined(subscription.msaUpdatedForDataConsent)) {
    return null;
  }
  return (
    <PanelItem key="tos-non-identifying">
      <p>
        {tct(
          'In accordance with our [link:Terms of Service], Sentry may use non-identifying elements of your service data for product improvement.',
          {
            link: <ExternalLink href="https://sentry.io/terms/" />,
          }
        )}
      </p>
    </PanelItem>
  );
}

export const DataConsentSettingsHeader = withSubscription(DataConsentHeader);
