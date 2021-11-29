import * as React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import CircleIndicator from 'sentry/components/circleIndicator';
import Confirm from 'sentry/components/confirm';
import Tooltip from 'sentry/components/tooltip';
import {IconDelete, IconFlag, IconSettings, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Integration, IntegrationProvider, ObjectStatus, Organization} from 'sentry/types';
import {IntegrationAnalyticsKey} from 'sentry/utils/analytics/integrationAnalyticsEvents';

import AddIntegrationButton from './addIntegrationButton';
import IntegrationItem from './integrationItem';

export type Props = {
  organization: Organization;
  provider: IntegrationProvider;
  integration: Integration;
  onRemove: (integration: Integration) => void;
  onDisable: (integration: Integration) => void;
  trackIntegrationAnalytics: (eventKey: IntegrationAnalyticsKey) => void; // analytics callback
  className?: string;
  requiresUpgrade?: boolean;
};

export default class InstalledIntegration extends React.Component<Props> {
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

  get removeConfirmProps() {
    const {integration} = this.props;
    const {body, actionText} = this.getRemovalBodyAndText(integration.provider.aspects);

    const message = (
      <React.Fragment>
        <Alert type="error" icon={<IconFlag size="md" />}>
          {t('Deleting this integration has consequences!')}
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
    const {body, actionText} = integration.provider.aspects.disable_dialog || {};
    const message = (
      <React.Fragment>
        <Alert type="error" icon={<IconFlag size="md" />}>
          {t('This integration cannot be removed in Sentry')}
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
    const {className, integration, organization, provider, requiresUpgrade} = this.props;

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
              <Tooltip
                disabled={hasAccess}
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
                    disabled={!(hasAccess && integration.status === 'active')}
                    icon={<IconWarning />}
                    onAddIntegration={() => {}}
                    organization={organization}
                    provider={provider}
                    priority="primary"
                    size="small"
                  />
                )}
                <StyledButton
                  borderless
                  icon={<IconSettings />}
                  disabled={!(hasAccess && integration.status === 'active')}
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

            <StyledIntegrationStatus status={integration.status} />
          </IntegrationFlex>
        )}
      </Access>
    );
  }
}

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray300};
`;

const IntegrationFlex = styled('div')`
  display: flex;
  align-items: center;
`;

const IntegrationItemBox = styled('div')`
  flex: 1;
`;

const IntegrationStatus = (
  props: React.HTMLAttributes<HTMLDivElement> & {status: ObjectStatus}
) => {
  const theme = useTheme();
  const {status, ...p} = props;
  const color = status === 'active' ? theme.success : theme.gray300;
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
