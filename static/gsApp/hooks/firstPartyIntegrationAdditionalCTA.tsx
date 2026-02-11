import {Flex} from '@sentry/scraps/layout';

import type {Integration} from 'sentry/types/integrations';

import UpsellButton from 'getsentry/components/upsellButton';

type Props = {
  integrations: Integration[];
};

function FirstPartyIntegrationAdditionalCTA({integrations}: Props) {
  // only render this upsell CTA when we have disabled integrations or one on grace perioid
  const disabledOrGracePeriodIntegrations = integrations.filter(
    i => i.organizationIntegrationStatus === 'disabled' || !!i.gracePeriodEnd
  );
  if (disabledOrGracePeriodIntegrations.length === 0) {
    return null;
  }
  const integration = disabledOrGracePeriodIntegrations[0]!;
  const alertType =
    integration.organizationIntegrationStatus === 'disabled'
      ? 'disabled-integration'
      : 'grace-period';
  const provider = integration.provider.key;
  return (
    <Flex justify="center" align="center" marginLeft="2xl">
      <UpsellButton
        source={`integration-additional-cta-alert-hook-${alertType}-${provider}`}
        size="sm"
        priority="primary"
        extraAnalyticsParams={{
          integration: provider,
          integration_type: 'first-party',
        }}
      />
    </Flex>
  );
}
export default FirstPartyIntegrationAdditionalCTA;
