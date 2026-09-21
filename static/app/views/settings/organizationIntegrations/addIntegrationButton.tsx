import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import {Button} from '@sentry/scraps/button';

import {useIntegrationInstallFlow} from './integrationInstallFlow';

type AddIntegrationButtonProps = {
  provider: IntegrationWithConfig['provider'];
  analyticsParams?: {
    already_installed: boolean;
    view: 'integrations_directory_integration_detail' | 'onboarding';
  };
  buttonProps?: React.ComponentProps<typeof Button>;
  label?: React.ReactNode;
  onAddIntegration?: () => void;
  onCancel?: () => void;
  onError?: () => void;
  suppressSuccessMessage?: boolean;
};

export function AddIntegrationButton({
  provider,
  analyticsParams,
  onAddIntegration,
  buttonProps,
  suppressSuccessMessage,
  onCancel,
  onError,
  label = t('Add Integration'),
}: AddIntegrationButtonProps) {
  const organization = useOrganization();

  const {startFlow} = useIntegrationInstallFlow({
    provider,
    organization,
    onInstall: onAddIntegration,
    analyticsParams,
    suppressSuccessMessage,
    startFlow,
  });

  return (
    <Button
      disabled={!provider.canAdd}
      {...buttonProps}
      tooltipProps={{
        title: `Integration cannot be added on Sentry. Enable this integration via the ${provider.name} instance.`,
      }}
      onClick={() => {
        if (label === t('Reinstall')) {
          trackAnalytics('integrations.integration_reinstall_clicked', {
            organization,
            provider: provider.metadata.noun,
          });
        }
        startFlow({
          provider,
          organization,
          onInstall: onAddIntegration,
          analyticsParams,
          suppressSuccessMessage,
          onCancel,
          onError,
        });
      }}
      aria-label={t('Add integration')}
    >
      {label}
    </Button>
  );
}
