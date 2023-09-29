import {Button, ButtonProps} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {IntegrationWithConfig} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

import AddIntegration from './addIntegration';

interface AddIntegrationButtonProps
  extends Omit<ButtonProps, 'children' | 'analyticsParams'>,
    Pick<
      React.ComponentProps<typeof AddIntegration>,
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
    buttonText ?? reinstall
      ? t('Enable')
      : installStatus === 'Disabled'
      ? t('Reinstall')
      : t('Add %s', provider.metadata.noun);

  return (
    <Tooltip
      disabled={provider.canAdd}
      title={`Integration cannot be added on Sentry. Enable this integration via the ${provider.name} instance.`}
    >
      <AddIntegration
        provider={provider}
        onInstall={onAddIntegration}
        organization={organization}
        analyticsParams={analyticsParams}
        modalParams={modalParams}
      >
        {onClick => (
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
              onClick();
            }}
            aria-label={t('Add integration')}
          >
            {label}
          </Button>
        )}
      </AddIntegration>
    </Tooltip>
  );
}
