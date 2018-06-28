import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';

const CONFIGURABLE_FEATURES = ['commits'];

export default class InstalledIntegration extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    provider: PropTypes.object.isRequired,
    integration: PropTypes.object.isRequired,
    onRemove: PropTypes.func.isRequired,
    onDisable: PropTypes.func.isRequired
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
      integration.configProject.length > 0 ||
      provider.canAddProject ||
      provider.features.filter(f => CONFIGURABLE_FEATURES.includes(f)).length > 0
    );
  }

  mergeIntegration() {}

  renderDisableIntegration(integration) {
    const {body, actionText} = integration.provider.aspects.disable_dialog;
    const message = (
      <div>
        <Alert type="error" icon="icon-circle-exclamation">
          This integration cannot be removed on Sentry
        </Alert>
        {body}
      </div>
    );

    return (
      <Confirm
        confirmText={actionText}
        message={message}
        priority="danger"
        onConfirm={() => this.props.onDisable(integration)}>
        <Button size="small" icon="icon-trash" />
      </Confirm>
    );
  }

  renderRemoveIntegration(integration) {
    const {body, actionText} = integration.provider.aspects.removal_dialog;
    const message = (
      <div>
        <Alert type="error" icon="icon-circle-exclamation">
          Deleting this integration has consequences!
        </Alert>
        {body}
      </div>
    );
    return (
      <Confirm
        message={message}
        confirmText={actionText}
        priority="danger"
        onConfirm={() => this.props.onRemove()}>
        <Button size="small" icon="icon-trash" />
      </Confirm>
    );
  }

  render() {
    const {integration, provider, orgId} = this.props;
    const style =
      integration.status === 'disabled' ? {filter: 'grayscale(1)', opacity: '0.4'} : {};

    return (
      <React.Fragment>
        <PanelItem p={0} py={2} key={integration.id} align="center">
          <Box px={2} flex={1} style={style}>
            <IntegrationItem integration={integration} />
          </Box>
          {integration.status === 'active' &&
          this.hasConfiguration() && (
            <Box mr={1}>
              <Button
                size="small"
                to={`/settings/${orgId}/integrations/${provider.key}/${integration.id}/`}>
                {t('Configure')}
              </Button>
            </Box>
          )}
          {integration.status === 'disabled' && (
            <Box mr={1}>
              <AddIntegrationButton
                size="small"
                priority="danger"
                provider={provider}
                integration={integration}
                onAddIntegration={this.mergeIntegration}
                reinstall={true}
              />
            </Box>
          )}
          <Box mr={1} pr={2}>
            {integration.status === 'active' && integration.provider.key === 'github' ? (
              this.renderDisableIntegration(integration)
            ) : (
              this.renderRemoveIntegration(integration)
            )}
          </Box>
        </PanelItem>
      </React.Fragment>
    );
  }
}
