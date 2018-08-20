import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import AddIntegration from 'app/views/organizationIntegrations/addIntegration';
import Button from 'app/components/buttons/button';
import Tooltip from 'app/components/tooltip';

export default class AddIntegrationButton extends React.Component {
  static propTypes = {
    provider: PropTypes.object.isRequired,
    onAddIntegration: PropTypes.func.isRequired,
    buttonText: PropTypes.string,
    reinstall: PropTypes.bool,
  };

  render() {
    // eslint-disable-next-line no-unused-vars
    const {provider, buttonText, onAddIntegration, reinstall, ...buttonProps} = this.props;

    const label = buttonText ||
      t(reinstall ? 'Enable' : 'Add %s', provider.metadata.noun);

    return (
      <Tooltip
        disabled={provider.canAdd}
        title={`Integration cannot be added on Sentry. Enable this integration via the ${provider.name} instance.`}
      >
        <span>
          <AddIntegration provider={provider} onInstall={this.props.onAddIntegration}>
            {onClick => (
              <Button {...buttonProps} disabled={!provider.canAdd} onClick={onClick}>
                {label}
              </Button>
            )}
          </AddIntegration>
        </span>
      </Tooltip>
    );
  }
}
