import {Component, Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import CircleIndicator from 'sentry/components/circleIndicator';
import Confirm from 'sentry/components/confirm';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDelete, IconSettings, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Integration, IntegrationProvider, ObjectStatus, Organization} from 'sentry/types';
import {IntegrationAnalyticsKey} from 'sentry/utils/analytics/integrations';

import {AddIntegrationButton} from './addIntegrationButton';
import IntegrationItem from './integrationItem';

type Props = {
  integration: Integration;
  onDisable: (integration: Integration) => void;
  onRemove: (integration: Integration) => void;
  organization: Organization;
  provider: IntegrationProvider;
  trackIntegrationAnalytics: (eventKey: IntegrationAnalyticsKey) => void; // analytics callback
  requiresUpgrade?: boolean;
};

export default class InstalledIntegration extends Component<Props> {
  handleUninstallClick = () => {
    this.props.trackIntegrationAnalytics('integrations.uninstall_clicked');
  };

  getRemovalBodyAndText(aspects: Integration['provider']['aspects']) {
    if (aspects && aspects.removal_dialog) {
      return {
        body: aspects.removal_dialog.body,
        actionText: aspects.removal_dialog.actionText,
      };
    }
    return {
      body: t(
        'Deleting this integration will remove any project associated data. This action cannot be undone. Are you sure you want to delete this integration?'
      ),
      actionText: t('Delete'),
    };
  }

  handleRemove(integration: Integration) {
    this.props.onRemove(integration);
    this.props.trackIntegrationAnalytics('integrations.uninstall_completed');
  }

  get integrationStatus() {
    const {integration} = this.props;
    // there are multiple status fields for an integration we consider
    const statusList = [integration.status, integration.organizationIntegrationStatus];
    const firstNotActive = statusList.find(s => s !== 'active');
    // Active if everything is active, otherwise the first inactive status
    return firstNotActive ?? 'active';
  }

  get removeConfirmProps() {
    const {integration} = this.props;
    const {body, actionText} = this.getRemovalBodyAndText(integration.provider.aspects);

    const message = (
      <Fragment>
        <Alert type="error" showIcon>
          {t('Deleting this integration has consequences!')}
        </Alert>
        {body}
      </Fragment>
    );
    return {
      message,
      confirmText: actionText,
      onConfirm: () => this.handleRemove(integration),
    };
  }

  get disableConfirmProps() {
    const {integration} = this.props;
    const {body, actionText} = integration.provider.aspects.disable_dialog || {};
    const message = (
      <Fragment>
        <Alert type="error" showIcon>
          {t('This integration cannot be removed in Sentry')}
        </Alert>
        {body}
      </Fragment>
    );

    return {
      message,
      confirmText: actionText,
      onConfirm: () => this.props.onDisable(integration),
    };
  }

  render() {
    const {integration, organization, provider, requiresUpgrade} = this.props;

    const removeConfirmProps =
      this.integrationStatus === 'active' && integration.provider.canDisable
        ? this.disableConfirmProps
        : this.removeConfirmProps;

    const allowMemberConfiguration = ['github', 'gitlab'].includes(
      this.props.provider.key
    );

    return (
      <Access organization={organization} access={['org:integrations']}>
        {({hasAccess}) => {
          const disableAction = !(hasAccess && this.integrationStatus === 'active');
          return (
            <Fragment>
              <IntegrationItemBox>
                <IntegrationItem integration={integration} />
              </IntegrationItemBox>
              <div>
                <Tooltip
                  disabled={allowMemberConfiguration || hasAccess}
                  position="left"
                  title={t(
                    'You must be an organization owner, manager or admin to configure'
                  )}
                >
                  {requiresUpgrade && (
                    <AddIntegrationButton
                      analyticsParams={{
                        view: 'integrations_directory_integration_detail',
                        already_installed: true,
                      }}
                      buttonText={t('Update Now')}
                      data-test-id="integration-upgrade-button"
                      disabled={disableAction}
                      icon={<IconWarning />}
                      onAddIntegration={() => {}}
                      organization={organization}
                      provider={provider}
                      priority="primary"
                      size="sm"
                    />
                  )}
                  <StyledButton
                    borderless
                    icon={<IconSettings />}
                    disabled={!allowMemberConfiguration && disableAction}
                    to={`/settings/${organization.slug}/integrations/${provider.key}/${integration.id}/`}
                    data-test-id="integration-configure-button"
                  >
                    {t('Configure')}
                  </StyledButton>
                </Tooltip>
              </div>
              <div>
                <Tooltip
                  disabled={hasAccess}
                  title={t(
                    'You must be an organization owner, manager or admin to uninstall'
                  )}
                >
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
                      {t('Uninstall')}
                    </StyledButton>
                  </Confirm>
                </Tooltip>
              </div>
              <StyledIntegrationStatus
                status={this.integrationStatus}
                // Let the hook handle the alert for disabled org integrations
                hideTooltip={integration.organizationIntegrationStatus === 'disabled'}
              />
            </Fragment>
          );
        }}
      </Access>
    );
  }
}

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray300};
`;

const IntegrationItemBox = styled('div')`
  flex: 1;
`;

const IntegrationStatus = (
  props: React.HTMLAttributes<HTMLDivElement> & {
    status: ObjectStatus;
    hideTooltip?: boolean;
  }
) => {
  const theme = useTheme();
  const {status, hideTooltip, ...p} = props;
  const color = status === 'active' ? theme.success : theme.gray300;
  const inner = (
    <div {...p}>
      <CircleIndicator size={6} color={color} />
      <IntegrationStatusText data-test-id="integration-status">{`${
        status === 'active'
          ? t('enabled')
          : status === 'disabled'
          ? t('disabled')
          : t('pending deletion')
      }`}</IntegrationStatusText>
    </div>
  );
  return hideTooltip ? (
    inner
  ) : (
    <Tooltip
      title={
        status === 'active'
          ? t('This integration can be disabled by clicking the Uninstall button')
          : status === 'disabled'
          ? t('This integration has been disconnected from the external provider')
          : t('This integration is pending deletion.')
      }
    >
      {inner}
    </Tooltip>
  );
};

const StyledIntegrationStatus = styled(IntegrationStatus)`
  display: flex;
  align-items: center;
  color: ${p => p.theme.gray300};
  font-weight: light;
  text-transform: capitalize;
  &:before {
    content: '|';
    color: ${p => p.theme.gray200};
    margin-right: ${space(1)};
    font-weight: normal;
  }
`;

const IntegrationStatusText = styled('div')`
  margin: 0 ${space(0.75)} 0 ${space(0.5)};
`;
