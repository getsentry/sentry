import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete} from 'app/icons/iconDelete';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import Tooltip from 'app/components/tooltip';
import {IntegrationProvider, Integration, Organization, ObjectStatus} from 'app/types';
import {SingleIntegrationEvent} from 'app/utils/integrationUtil';
import CircleIndicator from 'app/components/circleIndicator';
import theme from 'app/utils/theme';
import space from 'app/styles/space';

const CONFIGURABLE_FEATURES = ['commits', 'alert-rule'];

export type Props = {
  organization: Organization;
  provider: IntegrationProvider;
  integration: Integration;
  onRemove: (integration: Integration) => void;
  onDisable: (integration: Integration) => void;
  onReinstallIntegration: (integration: Integration) => void;
  trackIntegrationEvent: (
    options: Pick<SingleIntegrationEvent, 'eventKey' | 'eventName'>
  ) => void; //analytics callback
  className?: string;
};

//TODO: Rename to InstalledIntegration when we can remove the old one
export default class InstalledIntegrationInDirectory extends React.Component<Props> {
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

  handleUninstallClick = () => {
    this.props.trackIntegrationEvent({
      eventKey: 'integrations.uninstall_clicked',
      eventName: 'Integrations: Uninstall Clicked',
    });
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

  handleRemove(integration: Integration) {
    this.props.onRemove(integration);
    this.props.trackIntegrationEvent({
      eventKey: 'integrations.uninstall_completed',
      eventName: 'Integrations: Uninstall Completed',
    });
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
      onConfirm: () => this.handleRemove(integration),
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
    const {className, integration, provider, organization} = this.props;

    const removeConfirmProps =
      integration.status === 'active' && integration.provider.canDisable
        ? this.disableConfirmProps
        : this.removeConfirmProps;

    return (
      <Access access={['org:integrations']}>
        {({hasAccess}) => (
          <IntegrationFlex key={integration.id} className={className}>
            <IntegrationItemBox>
              <IntegrationItem integration={integration} />
            </IntegrationItemBox>
            <div>
              {
                <Tooltip
                  disabled={this.hasConfiguration()}
                  position="left"
                  title="Integration not configurable"
                >
                  <StyledButton
                    borderless
                    icon="icon-settings"
                    disabled={
                      !this.hasConfiguration() ||
                      !hasAccess ||
                      integration.status !== 'active'
                    }
                    to={`/settings/${organization.slug}/integrations/${provider.key}/${integration.id}/`}
                    data-test-id="integration-configure-button"
                  >
                    Configure
                  </StyledButton>
                </Tooltip>
              }
            </div>
            <div>
              <Confirm
                priority="danger"
                onConfirming={this.handleUninstallClick}
                disabled={!hasAccess}
                {...removeConfirmProps}
              >
                <StyledButton
                  disabled={!hasAccess}
                  borderless
                  icon={<IconDelete />}
                  data-test-id="integration-remove-button"
                >
                  Uninstall
                </StyledButton>
              </Confirm>
            </div>

            <IntegrationStatus status={integration.status} />
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

const IntegrationStatus = styled(
  (props: React.HTMLAttributes<HTMLElement> & {status: ObjectStatus}) => {
    const {status, ...p} = props;
    const color = status === 'active' ? theme.success : theme.gray2;
    const titleText =
      status === 'active'
        ? t('This Integration can be disabled by clicking the Uninstall button')
        : t('This Integration has been disconnected from the external provider');
    return (
      <Tooltip title={titleText}>
        <div {...p}>
          <CircleIndicator size={6} color={color} />
          <IntegrationStatusText>{`${
            status === 'active' ? t('enabled') : t('disabled')
          }`}</IntegrationStatusText>
        </div>
      </Tooltip>
    );
  }
)`
  display: flex;
  align-items: center;
  color: ${p => p.theme.gray2};
  font-weight: light;
  text-transform: capitalize;
  &:before {
    content: '|';
    color: ${p => p.theme.gray1};
    margin-right: ${space(1)};
    font-weight: normal;
  }
`;

const IntegrationStatusText = styled('div')`
  margin: 0 ${space(0.75)} 0 ${space(0.5)};
`;
