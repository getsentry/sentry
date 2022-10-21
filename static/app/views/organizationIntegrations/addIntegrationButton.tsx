import Button, {ButtonPropsWithoutAriaLabel} from 'sentry/components/button';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {IntegrationWithConfig} from 'sentry/types';

import AddIntegration from './addIntegration';

interface AddIntegrationButtonProps
  extends Omit<ButtonPropsWithoutAriaLabel, 'children'>,
    Pick<
      React.ComponentProps<typeof AddIntegration>,
      'provider' | 'organization' | 'analyticsParams' | 'modalParams'
    > {
  onAddIntegration: (data: IntegrationWithConfig) => void;
  buttonText?: string;
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
  ...buttonProps
}: AddIntegrationButtonProps) {
  const label =
    buttonText ?? (reinstall ? t('Enable') : t('Add %s', provider.metadata.noun));

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
            onClick={() => onClick()}
            aria-label={t('Add integration')}
          >
            {label}
          </Button>
        )}
      </AddIntegration>
    </Tooltip>
  );
}
