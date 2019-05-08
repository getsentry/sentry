import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import AddIntegration from 'app/views/organizationIntegrations/addIntegration';
import Button from 'app/components/button';
import Tooltip2 from 'app/components/tooltip2';

export default class AddIntegrationButton extends React.Component {
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
      <Tooltip2
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
      </Tooltip2>
    );
  }
}
