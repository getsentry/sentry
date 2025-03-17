import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
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
    <ButtonWrapper>
      <UpsellButton
        source={`integration-additional-cta-alert-hook-${alertType}-${provider}`}
        size="sm"
        priority="primary"
        extraAnalyticsParams={{
          integration: provider,
          integration_type: 'first-party',
        }}
      />
    </ButtonWrapper>
  );
}
export default FirstPartyIntegrationAdditionalCTA;

const ButtonWrapper = styled('div')`
  display: flex;
  margin-left: ${space(3)};
  align-items: center;
  justify-content: center;
`;
