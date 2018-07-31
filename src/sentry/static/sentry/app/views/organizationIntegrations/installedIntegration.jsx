import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';
import Alert from 'app/components/alert';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import Tooltip from 'app/components/tooltip';

const CONFIGURABLE_FEATURES = ['commits'];

const removeButton = (
  <Button borderless size="xsmall" icon="icon-trash">
    Remove
  </Button>
);

export default class InstalledIntegration extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    provider: PropTypes.object.isRequired,
    integration: PropTypes.object.isRequired,
    onRemove: PropTypes.func.isRequired,
    onDisable: PropTypes.func.isRequired,
    onReinstallIntegration: PropTypes.func.isRequired,
  };

  /**
   * Integrations have additional configuration when any of the conditions are
   * met:
   *
   * - The Integration has organization-specific configuration options.
   * - The Integration can be enabled for projects.
   * - The Integration has configurable features
   */
  hasConfiguration() {
    const {integration, provider} = this.props;

    return (
      integration.configOrganization.length > 0 ||
      provider.canAddProject ||
      provider.features.filter(f => CONFIGURABLE_FEATURES.includes(f)).length > 0
    );
  }

  reinstallIntegration = integration => {
    const activeIntegration = Object.assign({}, this.props.integration, {
      status: 'active',
    });
    this.props.onReinstallIntegration(activeIntegration);
  };

  renderDisableIntegration(integration) {
    const {body, actionText} = integration.provider.aspects.disable_dialog;
    const message = (
      <React.Fragment>
        <Alert type="error" icon="icon-circle-exclamation">
          This integration cannot be removed on Sentry
        </Alert>
        {body}
      </React.Fragment>
    );

    return (
      <Confirm
        confirmText={actionText}
        message={message}
        priority="danger"
        onConfirm={() => this.props.onDisable(integration)}
      >
        {removeButton}
      </Confirm>
    );
  }

  getRemovalBodyAndText(aspects) {
    if (aspects && aspects.removal_dialog) {
      return {
        body: aspects.removal_dialog.body,
        actionText: aspects.removal_dialog.actionText,
      };
    } else {
      return {
        body: t(
          'Deleting this integration will remove any project associated data. This action cannot be undone. Are you sure you want to delete this integration?'
        ),
        actionText: t('Delete'),
      };
    }
  }

  renderRemoveIntegration(integration) {
    const {body, actionText} = this.getRemovalBodyAndText(integration.provider.aspects);

    const message = (
      <React.Fragment>
        <Alert type="error" icon="icon-circle-exclamation">
          Deleting this integration has consequences!
        </Alert>
        {body}
      </React.Fragment>
    );
    return (
      <Confirm
        message={message}
        confirmText={actionText}
        priority="danger"
        onConfirm={() => this.props.onRemove(integration)}
      >
        {removeButton}
      </Confirm>
    );
  }

  render() {
    const {className, integration, provider, orgId} = this.props;

    return (
      <Flex align="center" key={integration.id} className={className}>
        <Box flex={1}>
          <IntegrationItem compact integration={integration} />
        </Box>
        <Box mr={1}>
          {integration.status === 'disabled' && (
            <AddIntegrationButton
              size="xsmall"
              priority="danger"
              provider={provider}
              integration={integration}
              onAddIntegration={this.reinstallIntegration}
              reinstall={true}
            />
          )}
          {integration.status === 'active' && (
            <Tooltip
              disabled={this.hasConfiguration()}
              tooltipOptions={{placement: 'left'}}
              title="Integration not configurable"
            >
              <span>
                <Button
                  borderless
                  size="xsmall"
                  icon="icon-settings"
                  disabled={!this.hasConfiguration()}
                  to={`/settings/${orgId}/integrations/${provider.key}/${integration.id}/`}
                >
                  Configure
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>
        <Box>
          {integration.status === 'active' && integration.provider.canDisable
            ? this.renderDisableIntegration(integration)
            : this.renderRemoveIntegration(integration)}
        </Box>
      </Flex>
    );
  }
}
