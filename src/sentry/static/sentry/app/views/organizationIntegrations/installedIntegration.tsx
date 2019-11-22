import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import Tooltip from 'app/components/tooltip';
import {IntegrationProvider, Integration} from 'app/types';

const CONFIGURABLE_FEATURES = ['commits', 'alert-rule'];

export type Props = {
  orgId: string;
  provider: IntegrationProvider;
  integration: Integration;
  onRemove: (integration: Integration) => void;
  onDisable: (integration: Integration) => void;
  onReinstallIntegration: (integration: Integration) => void;
  className?: string;
};

export default class InstalledIntegration extends React.Component<Props> {
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
   * - The Integration has configurable features
   */
  hasConfiguration() {
    const {integration, provider} = this.props;

    return (
      integration.configOrganization.length > 0 ||
      provider.features.filter(f => CONFIGURABLE_FEATURES.includes(f)).length > 0
    );
  }

  reinstallIntegration = () => {
    const activeIntegration = Object.assign({}, this.props.integration, {
      status: 'active',
    });
    this.props.onReinstallIntegration(activeIntegration);
  };

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

  get removeConfirmProps() {
    const {integration} = this.props;
    const {body, actionText} = this.getRemovalBodyAndText(integration.provider.aspects);

    const message = (
      <React.Fragment>
        <Alert type="error" icon="icon-circle-exclamation">
          Deleting this integration has consequences!
        </Alert>
        {body}
      </React.Fragment>
    );
    return {
      message,
      confirmText: actionText,
      onConfirm: () => this.props.onRemove(integration),
    };
  }

  get disableConfirmProps() {
    const {integration} = this.props;
    const {body, actionText} = integration.provider.aspects.disable_dialog;
    const message = (
      <React.Fragment>
        <Alert type="error" icon="icon-circle-exclamation">
          This integration cannot be removed on Sentry
        </Alert>
        {body}
      </React.Fragment>
    );

    return {
      message,
      confirmText: actionText,
      onConfirm: () => this.props.onDisable(integration),
    };
  }

  render() {
    const {className, integration, provider, orgId} = this.props;

    const removeConfirmProps =
      integration.status === 'active' && integration.provider.canDisable
        ? this.disableConfirmProps
        : this.removeConfirmProps;

    return (
      <Access access={['org:integrations']}>
        {({hasAccess}) => (
          <IntegrationFlex key={integration.id} className={className}>
            <IntegrationItemBox>
              <IntegrationItem compact integration={integration} />
            </IntegrationItemBox>
            <div>
              {integration.status === 'disabled' && (
                <AddIntegrationButton
                  size="xsmall"
                  priority="success"
                  provider={provider}
                  onAddIntegration={this.reinstallIntegration}
                  reinstall
                />
              )}
              {integration.status === 'active' && (
                <Tooltip
                  disabled={this.hasConfiguration()}
                  position="left"
                  title="Integration not configurable"
                >
                  <StyledButton
                    borderless
                    icon="icon-settings"
                    disabled={!this.hasConfiguration() || !hasAccess}
                    to={`/settings/${orgId}/integrations/${provider.key}/${
                      integration.id
                    }/`}
                    data-test-id="integration-configure-button"
                  >
                    Configure
                  </StyledButton>
                </Tooltip>
              )}
            </div>
            <div>
              <Confirm priority="danger" disabled={!hasAccess} {...removeConfirmProps}>
                <StyledButton
                  disabled={!hasAccess}
                  borderless
                  icon="icon-trash"
                  data-test-id="integration-remove-button"
                >
                  Uninstall
                </StyledButton>
              </Confirm>
            </div>
          </IntegrationFlex>
        )}
      </Access>
    );
  }
}

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray2};
`;

const IntegrationFlex = styled('div')`
  display: flex;
  align-items: center;
`;

const IntegrationItemBox = styled('div')`
  flex: 1;
`;
