import {Component, Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {Button, LinkButton} from 'sentry/components/button';
import CircleIndicator from 'sentry/components/circleIndicator';
import Confirm from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDelete, IconSettings, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ObjectStatus} from 'sentry/types/core';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {IntegrationAnalyticsKey} from 'sentry/utils/analytics/integrations';
import {getIntegrationStatus} from 'sentry/utils/integrationUtil';

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
    if (aspects?.removal_dialog) {
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
    return getIntegrationStatus(integration);
  }

  get removeConfirmProps() {
    const {integration} = this.props;
    const {body, actionText} = this.getRemovalBodyAndText(integration.provider.aspects);

    const message = (
      <Fragment>
        <Alert.Container>
          <Alert type="error" showIcon>
            {t('Deleting this integration has consequences!')}
          </Alert>
        </Alert.Container>
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
        <Alert.Container>
          <Alert type="error" showIcon>
            {t('This integration cannot be removed in Sentry')}
          </Alert>
        </Alert.Container>
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
      <Access access={['org:integrations']}>
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
                  <StyledLinkButton
                    borderless
                    icon={<IconSettings />}
                    disabled={!allowMemberConfiguration && disableAction}
                    to={`/settings/${organization.slug}/integrations/${provider.key}/${integration.id}/`}
                    data-test-id="integration-configure-button"
                  >
                    {t('Configure')}
                  </StyledLinkButton>
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

const StyledLinkButton = styled(LinkButton)`
  color: ${p => p.theme.gray300};
`;

const IntegrationItemBox = styled('div')`
  flex: 1;
`;

function IntegrationStatus(
  props: React.HTMLAttributes<HTMLDivElement> & {
    status: ObjectStatus;
    hideTooltip?: boolean;
  }
) {
  const theme = useTheme();
  const {status, hideTooltip, ...p} = props;
  const color = status === 'active' ? theme.success : theme.gray300;
  const inner = (
    <div {...p}>
      <CircleIndicator size={6} color={color} />
      <IntegrationStatusText data-test-id="integration-status">{`${
        status === 'active'
          ? t('enabled')
          : status === 'pending_deletion'
            ? t('pending deletion')
            : status === 'disabled'
              ? t('disabled')
              : t('unknown')
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
}

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
    font-weight: ${p => p.theme.fontWeightNormal};
  }
`;

const IntegrationStatusText = styled('div')`
  margin: 0 ${space(0.75)} 0 ${space(0.5)};
`;
