import React from 'react';

import Button from 'app/components/button';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {IntegrationWithConfig} from 'app/types';

import AddIntegration from './addIntegration';

type Props = {
  onAddIntegration: (data: IntegrationWithConfig) => void;
  buttonText?: string;
  reinstall?: boolean;
} & React.ComponentProps<typeof Button> &
  Pick<
    React.ComponentProps<typeof AddIntegration>,
    'provider' | 'organization' | 'integrationId' | 'analyticsParams' | 'modalParams'
  >;

export default class AddIntegrationButton extends React.Component<Props> {
  render() {
    const {
      provider,
      buttonText,
      onAddIntegration,
      organization,
      reinstall,
      integrationId,
      analyticsParams,
      modalParams,
      ...buttonProps
    } = this.props;

    const label =
      buttonText || t(reinstall ? 'Enable' : 'Add %s', provider.metadata.noun);

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
          integrationId={integrationId}
          modalParams={modalParams}
        >
          {onClick => (
            <Button
              disabled={!provider.canAdd}
              {...buttonProps}
              onClick={() => onClick()}
            >
              {label}
            </Button>
          )}
        </AddIntegration>
      </Tooltip>
    );
  }
}
