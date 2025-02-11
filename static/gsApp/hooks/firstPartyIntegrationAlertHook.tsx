import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {getUserTimezone} from 'sentry/utils/dates';
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
          moment(integration.gracePeriodEnd)
            .tz(getUserTimezone())
            .format('MMMM Do, YYYY h:mm A z')
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
    <Alert type="warning" showIcon>
      <InnerAlertWrapper>
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
      </InnerAlertWrapper>
    </Alert>
  );
  return wrapWithContainer ? (
    <AlertContainer>{wrappedAlert}</AlertContainer>
  ) : (
    wrappedAlert
  );
}
export default FirstPartyIntegrationAlertHook;

const InnerAlertWrapper = styled('div')`
  width: 100%;
  display: flex;
  justify-content: space-between;
`;
