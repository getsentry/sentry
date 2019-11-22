import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import AddIntegration from 'app/views/organizationIntegrations/addIntegration';
import Button from 'app/components/button';
import Tooltip from 'app/components/tooltip';
import {IntegrationProvider, Integration} from 'app/types';

type Props = {
  provider: IntegrationProvider;
  onAddIntegration: (data: Integration) => void;
  buttonText?: string;
  reinstall?: boolean;
} & React.ComponentProps<typeof Button>;

export default class AddIntegrationButton extends React.Component<Props> {
  static propTypes = {
    provider: PropTypes.object.isRequired,
    onAddIntegration: PropTypes.func.isRequired,
    buttonText: PropTypes.string,
    reinstall: PropTypes.bool,
  };

  render() {
    const {
      provider,
      buttonText,
      onAddIntegration,
      reinstall,
      ...buttonProps
    } = this.props;

    const label =
      buttonText || t(reinstall ? 'Enable' : 'Add %s', provider.metadata.noun);

    return (
      <Tooltip
        disabled={provider.canAdd}
        title={`Integration cannot be added on Sentry. Enable this integration via the ${
          provider.name
        } instance.`}
      >
        <AddIntegration provider={provider} onInstall={onAddIntegration}>
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
