import React from 'react';

import Button from 'app/components/button';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {Integration, IntegrationProvider, Organization} from 'app/types';

import AddIntegration from './addIntegration';

type Props = {
  provider: IntegrationProvider;
  onAddIntegration: (data: Integration) => void;
  buttonText?: string;
  reinstall?: boolean;
  integrationId?: string;
  organization?: Organization; //for analytics
  analyticsParams?: {
    view: 'integrations_directory_integration_detail';
    already_installed: boolean;
  };
} & React.ComponentProps<typeof Button>;

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
