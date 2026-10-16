import {Fragment} from 'react';
import styled from '@emotion/styled';
import {IconDelete} from '@sentry/icons/delete';
import {IconSettings} from '@sentry/icons/settings';
import {IconWarning} from '@sentry/icons/warning';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Access} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import type {ObjectStatus} from 'sentry/types/core';
import type {
  IntegrationProvider,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {getSlackUpgradeModalParams} from 'sentry/utils/integrations/slackUpgradeModalParams';
import {openGithubPermissionsUpdateModal} from 'sentry/utils/integrations/useAutoOpenPermissionsModal';
import {getIntegrationStatus} from 'sentry/utils/integrationUtil';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';

import {AddIntegrationButton} from './addIntegrationButton';
import {IntegrationItem} from './integrationItem';

type Props = {
  integration: OrganizationIntegration;
  onDisable: (integration: OrganizationIntegration) => void;
  onRemove: (integration: OrganizationIntegration) => void;
  organization: Organization;
  provider: IntegrationProvider;
  trackIntegrationAnalytics: (
    eventKey: 'integrations.uninstall_clicked' | 'integrations.uninstall_completed'
  ) => void; // analytics callback
  requiresUpgrade?: boolean;
};

function getRemovalBodyAndText(aspects: OrganizationIntegration['provider']['aspects']) {
  if (aspects?.removal_dialog) {
    return {
      body: aspects.removal_dialog.body,
      actionText: aspects.removal_dialog.actionText,
    };
  }
  return {
    body: t(
      'Deleting this integration will remove any project associated data such as repositories, external tickets, team links. This will also disable all notifications sent by this integration. This action cannot be undone. Are you sure you want to delete this integration?'
    ),
    actionText: t('Delete'),
  };
}

export function InstalledIntegration({
  integration,
  onDisable,
  onRemove,
  organization,
  provider,
  trackIntegrationAnalytics,
  requiresUpgrade,
}: Props) {
  const integrationStatus = getIntegrationStatus(integration);

  const handleUninstallClick = () => {
    trackIntegrationAnalytics('integrations.uninstall_clicked');
  };

  const handleUpdatePermissionsClick = () => {
    openGithubPermissionsUpdateModal(integration);
  };

  const handleRemove = () => {
    onRemove(integration);
    trackIntegrationAnalytics('integrations.uninstall_completed');
  };

  const getRemoveConfirmProps = () => {
    const {body, actionText} = getRemovalBodyAndText(integration.provider.aspects);
    const message = (
      <Fragment>
        <Alert.Container>
          <Alert variant="danger">
            {t('Deleting this integration has consequences!')}
          </Alert>
        </Alert.Container>
        {body}
      </Fragment>
    );
    return {
      message,
      confirmText: actionText,
      onConfirm: handleRemove,
    };
  };

  const getDisableConfirmProps = () => {
    const {body, actionText} = integration.provider.aspects.disable_dialog || {};
    const message = (
      <Fragment>
        <Alert.Container>
          <Alert variant="danger">
            {t('This integration cannot be removed in Sentry')}
          </Alert>
        </Alert.Container>
        {body}
      </Fragment>
    );
    return {
      message,
      confirmText: actionText,
      onConfirm: () => onDisable(integration),
    };
  };

  const removeConfirmProps =
    integrationStatus === 'active' && integration.provider.canDisable
      ? getDisableConfirmProps()
      : getRemoveConfirmProps();

  const allowMemberConfiguration = ['github', 'gitlab'].includes(provider.key);

  return (
    <Access access={['org:integrations']}>
      {({hasAccess}) => {
        const superuser = isActiveSuperuser();
        const canUpdate = hasAccess || superuser;
        const canConfigure = canUpdate && integrationStatus === 'active';
        const disableAction = !canConfigure;
        const isPendingDeletion = integrationStatus === 'pending_deletion';
        return (
          <Fragment>
            <IntegrationItemBox>
              <IntegrationItem
                integration={integration}
                requiresUpgrade={requiresUpgrade}
              />
            </IntegrationItemBox>
            <div>
              {requiresUpgrade && (
                <Tooltip
                  disabled={canUpdate}
                  position="left"
                  title={t(
                    'You must be an organization owner, manager or admin to update'
                  )}
                >
                  {provider.key === 'github' ? (
                    <Button
                      data-test-id="integration-upgrade-button"
                      disabled={disableAction}
                      icon={<IconWarning />}
                      onClick={handleUpdatePermissionsClick}
                      variant="primary"
                      size="sm"
                    >
                      {t('Update Now')}
                    </Button>
                  ) : (
                    <AddIntegrationButton
                      analyticsParams={{
                        view: 'integrations_directory_integration_detail',
                        already_installed: true,
                      }}
                      modalParams={
                        provider.key === 'slack'
                          ? getSlackUpgradeModalParams(integration.missingFeatures)
                          : undefined
                      }
                      buttonText={t('Update %s', provider.name)}
                      data-test-id="integration-upgrade-button"
                      disabled={disableAction}
                      onAddIntegration={() => {}}
                      organization={organization}
                      provider={provider}
                      variant="primary"
                      size="sm"
                    />
                  )}
                </Tooltip>
              )}
              {!provider.metadata.aspects?.directEnable && (
                <Tooltip
                  disabled={allowMemberConfiguration || hasAccess || superuser}
                  position="left"
                  title={t(
                    'You must be an organization owner, manager or admin to configure'
                  )}
                >
                  <StyledLinkButton
                    variant="transparent"
                    icon={<IconSettings />}
                    disabled={!allowMemberConfiguration && !canConfigure}
                    to={`/settings/${organization.slug}/integrations/${provider.key}/${integration.id}/`}
                    data-test-id="integration-configure-button"
                  >
                    {t('Configure')}
                  </StyledLinkButton>
                </Tooltip>
              )}
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
                  onConfirming={handleUninstallClick}
                  disabled={!hasAccess || isPendingDeletion}
                  {...removeConfirmProps}
                >
                  <Button
                    disabled={!hasAccess || isPendingDeletion}
                    variant="transparent"
                    icon={<IconDelete />}
                    data-test-id="integration-remove-button"
                  >
                    {t('Uninstall')}
                  </Button>
                </Confirm>
              </Tooltip>
            </div>
            <IntegrationStatus
              status={integrationStatus}
              // Let the hook handle the alert for disabled org integrations
              hideTooltip={integration.organizationIntegrationStatus === 'disabled'}
            />
          </Fragment>
        );
      }}
    </Access>
  );
}

const StyledLinkButton = styled(LinkButton)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const IntegrationItemBox = styled('div')`
  flex: 1;
`;

function IntegrationStatus({
  status,
  hideTooltip,
}: {
  status: ObjectStatus;
  hideTooltip?: boolean;
}) {
  const label = {
    active: <Tag variant="success">{t('enabled')}</Tag>,
    pending_deletion: <Tag variant="info">{t('pending deletion')}</Tag>,
    disabled: <Tag variant="muted">{t('disabled')}</Tag>,
    deletion_in_progress: <Tag variant="muted">{t('unknown')}</Tag>,
  }[status] ?? <Tag variant="muted">{t('unknown')}</Tag>;

  return (
    <Tooltip
      disabled={hideTooltip}
      title={
        status === 'active'
          ? t('This integration can be disabled by clicking the Uninstall button')
          : status === 'disabled'
            ? t('This integration has been disconnected from the external provider')
            : t('Deletion takes a few minutes to complete.')
      }
      skipWrapper
    >
      <Flex align="center">
        <IntegrationStatusText data-test-id="integration-status">
          {label}
        </IntegrationStatusText>
      </Flex>
    </Tooltip>
  );
}

const IntegrationStatusText = styled('div')`
  margin: 0 ${p => p.theme.space.sm} 0 ${p => p.theme.space.xs};
`;
