import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';

import type {AddIntegrationParams} from './addIntegration';
import {useAddIntegration} from './addIntegration';

interface AddIntegrationButtonProps
  extends
    Omit<ButtonProps, 'children' | 'analyticsParams'>,
    Pick<
      AddIntegrationParams,
      'provider' | 'organization' | 'analyticsParams' | 'modalParams'
    > {
  onAddIntegration: (data: IntegrationWithConfig) => void;
  buttonText?: string;
  installStatus?: string;
  reinstall?: boolean;
}

export function AddIntegrationButton({
  provider,
  buttonText,
  onAddIntegration,
  organization,
  reinstall,
  analyticsParams,
  modalParams,
  installStatus,
  ...buttonProps
}: AddIntegrationButtonProps) {
  const label =
    buttonText ??
    (reinstall
      ? t('Enable')
      : installStatus === 'Disabled'
        ? t('Reinstall')
        : t('Add %s', provider.metadata.noun));

  const {startFlow} = useAddIntegration({
    provider,
    organization,
    onInstall: onAddIntegration,
    analyticsParams,
    modalParams,
  });

  return (
    <Tooltip
      disabled={provider.canAdd}
      title={`Integration cannot be added on Sentry. Enable this integration via the ${provider.name} instance.`}
    >
      <Button
        disabled={!provider.canAdd}
        {...buttonProps}
        onClick={() => {
          if (label === t('Reinstall')) {
            trackAnalytics('integrations.integration_reinstall_clicked', {
              organization,
              provider: provider.metadata.noun,
            });
          }
          startFlow();
        }}
        aria-label={t('Add integration')}
      >
        {label}
      </Button>
    </Tooltip>
  );
}
