import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {AddIntegrationParams} from 'sentry/utils/integrations/useAddIntegration';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import {useAutoOpenInstallModal} from 'sentry/utils/integrations/useAutoOpenInstallModal';

interface AddIntegrationButtonProps
  extends
    Omit<ButtonProps, 'children' | 'analyticsParams' | 'onError'>,
    Pick<
      AddIntegrationParams,
      | 'provider'
      | 'organization'
      | 'analyticsParams'
      | 'suppressSuccessMessage'
      | 'onCancel'
      | 'onError'
    > {
  onAddIntegration: (data: IntegrationWithConfig) => void;
  buttonText?: string;
  installStatus?: string;
}

export function AddIntegrationButton({
  provider,
  buttonText,
  onAddIntegration,
  organization,
  analyticsParams,
  installStatus,
  suppressSuccessMessage,
  onCancel,
  onError,
  ...buttonProps
}: AddIntegrationButtonProps) {
  const label =
    buttonText ??
    (installStatus === 'Disabled' ? t('Reinstall') : t('Add %s', provider.metadata.noun));

  const {startFlow} = useAddIntegration();

  useAutoOpenInstallModal({
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
      aria-label={t('Add integration')}
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
    >
      {label}
    </Button>
  );
}
