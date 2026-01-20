import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';

import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import AlertContainer from 'sentry/views/settings/organizationIntegrations/integrationAlertContainer';

import UpsellButton from 'getsentry/components/upsellButton';

type Props = {
  integrations: Integration[];
  hideCTA?: boolean;
  wrapWithContainer?: boolean;
};

function FirstPartyIntegrationAlertHook({
  integrations,
  wrapWithContainer,
  hideCTA,
}: Props) {
  const getAlertInfo = () => {
    const disabledIntegrations = integrations.filter(
      i => i.organizationIntegrationStatus === 'disabled'
    );
    if (disabledIntegrations.length > 0) {
      const integration = disabledIntegrations[0]!;
      return [
        t('Your %s integration has been disabled', integration.provider.name),
        'disabled-integration',
        integration.provider.key,
      ];
    }
    const integrationsWithGracePeriod = integrations.filter(i => !!i.gracePeriodEnd);
    if (integrationsWithGracePeriod.length > 0) {
      const integration = integrationsWithGracePeriod[0]!;
      return [
        t(
          'Your %s integration will be disabled after %s',
          integration.provider.name,
          moment(integration.gracePeriodEnd).format('MMMM Do, YYYY h:mm A z')
        ),
        'grace-period',
        integration.provider.key,
      ];
    }
    return [null, '', ''];
  };
  const [alert, alertType, provider] = getAlertInfo();
  if (!alert) {
    return null;
  }
  const wrappedAlert = (
    <Alert.Container>
      <Alert variant="warning">
        <Flex justify="between" width="100%">
          {alert}
          {!hideCTA && (
            <UpsellButton
              source={`integration-alert-hook-${alertType}-${provider}`}
              size="xs"
              priority="default"
              extraAnalyticsParams={{
                integration: provider,
                integration_type: 'first-party',
              }}
            />
          )}
        </Flex>
      </Alert>
    </Alert.Container>
  );
  return wrapWithContainer ? (
    <AlertContainer>{wrappedAlert}</AlertContainer>
  ) : (
    wrappedAlert
  );
}
export default FirstPartyIntegrationAlertHook;
