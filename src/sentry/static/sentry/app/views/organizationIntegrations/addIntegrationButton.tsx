import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import AddIntegration from 'app/views/organizationIntegrations/addIntegration';
import Button from 'app/components/button';
import Tooltip from 'app/components/tooltip';
import {IntegrationProvider, Integration, Organization} from 'app/types';
import SentryTypes from 'app/sentryTypes';

type Props = {
  provider: IntegrationProvider;
  onAddIntegration: (data: Integration) => void;
  buttonText?: string;
  reinstall?: boolean;
  organization?: Organization; //for analytics
  analyticsParams?: {
    view: 'integrations_directory_integration_detail' | 'integrations_directory';
    already_installed: boolean;
  };
} & React.ComponentProps<typeof Button>;

export default class AddIntegrationButton extends React.Component<Props> {
  static propTypes = {
    provider: PropTypes.object.isRequired,
    onAddIntegration: PropTypes.func.isRequired,
    buttonText: PropTypes.string,
    reinstall: PropTypes.bool,
    organization: SentryTypes.Organization,
  };

  render() {
    const {
      provider,
      buttonText,
      onAddIntegration,
      organization,
      reinstall,
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
