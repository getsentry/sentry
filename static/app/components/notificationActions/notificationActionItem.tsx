import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Badge from 'sentry/components/badge';
import {Button} from 'sentry/components/button';
import Card from 'sentry/components/card';
import Confirm, {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import NotificationActionForm from 'sentry/components/notificationActions/notificationActionForm';
import {IconDelete, IconEllipsis, IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {
  AvailableNotificationAction,
  NotificationAction,
  NotificationActionService,
} from 'sentry/types/notificationActions';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface NotificationActionItemProps {
  /**
   * The notification action being represented
   */
  action: Partial<NotificationAction>;
  /**
   * The available actions for the action's serviceType (e.g. "slack", "pagerduty")
   */
  availableActions: AvailableNotificationAction[];
  /**
   * The notif action's index in the parent component
   */
  index: number;
  onDelete: (actionId: number) => void;
  onUpdate: (actionId: number, updatedAction: NotificationAction) => void;
  /**
   * Map of pagerduty integration IDs to available actions for those IDs
   */
  pagerdutyIntegrations: Record<number, AvailableNotificationAction[]>;

  project: Project;
  defaultEdit?: boolean;
  /**
   * Optional list of roles to display as recipients of Sentry notifications
   */
  recipientRoles?: string[];
}

function NotificationActionItem({
  action,
  index,
  availableActions,
  defaultEdit = false,
  pagerdutyIntegrations,
  project,
  recipientRoles,
  onDelete,
  onUpdate,
}: NotificationActionItemProps) {
  const [isEditing, setIsEditing] = useState(defaultEdit);
  const serviceType = action.serviceType;
  const api = useApi();
  const organization = useOrganization();

  function renderIcon() {
    // Currently email and Sentry notification use the same icon
    if (
      serviceType === NotificationActionService.EMAIL ||
      serviceType === NotificationActionService.SENTRY_NOTIFICATION
    ) {
      return <IconMail size="sm" />;
    }
    return <PluginIcon pluginId={serviceType} size={16} />;
  }

  function renderDescription() {
    // TODO(enterprise): email, msteams
    if (serviceType === NotificationActionService.SENTRY_NOTIFICATION) {
      const roleElements = recipientRoles?.map(role => (
        <NotificationRecipient key={role}>{role}</NotificationRecipient>
      ));
      return (
        <Fragment>
          <div>{t('Send an email notification to the following roles')}</div>
          {roleElements}
        </Fragment>
      );
    }
    return (
      <Fragment>
        <div>{t('Send a notification to the')}</div>
        <NotificationRecipient>{action.targetDisplay}</NotificationRecipient>
        <div>
          {action.serviceType === NotificationActionService.SLACK
            ? t('channel')
            : t('service')}
        </div>
      </Fragment>
    );
  }

  async function handleDelete() {
    const endpoint = `/organizations/${organization.slug}/notifications/actions/${action.id}/`;
    try {
      await api.requestPromise(endpoint, {
        method: 'DELETE',
      });
      addSuccessMessage(t('Successfully deleted notification action'));
      onDelete(index);
    } catch (err) {
      addErrorMessage(t('Unable to delete notification action'));
    }
  }

  // Edit button is located outside of the form
  function renderEditButton() {
    if (serviceType === NotificationActionService.SENTRY_NOTIFICATION) {
      return (
        <Confirm
          onConfirm={handleDelete}
          message={t('Are you sure you want to delete this notification action?')}
        >
          <Button
            aria-label={t('Delete')}
            icon={<IconDelete />}
            size="xs"
            priority="danger"
            data-test-id="delete"
          />
        </Confirm>
      );
    }

    const menuItems: MenuItemProps[] = [
      {
        key: 'notificationaction-edit',
        label: t('Edit'),
        onAction: () => setIsEditing(true),
      },
      {
        key: 'notificationaction-delete',
        label: t('Delete'),
        priority: 'danger',
        onAction: () => {
          openConfirmModal({
            message: t('Are you sure you want to delete this notification action?'),
            onConfirm: handleDelete,
          });
        },
      },
    ];

    return (
      <DropdownMenu
        items={menuItems}
        trigger={triggerProps => (
          <Button
            {...triggerProps}
            aria-label={t('Actions')}
            size="xs"
            icon={<IconEllipsis direction="down" size="sm" />}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();

              triggerProps.onClick?.(e);
            }}
          />
        )}
      />
    );
  }

  return (
    <StyledCard>
      {isEditing ? (
        <NotificationActionContent>
          {renderIcon()}
          {serviceType === NotificationActionService.SENTRY_NOTIFICATION &&
            renderDescription()}
          <NotificationActionForm
            action={action}
            index={index}
            availableActions={availableActions}
            onDelete={onDelete}
            onUpdate={onUpdate}
            setIsEditing={setIsEditing}
            pagerdutyIntegrations={pagerdutyIntegrations}
            project={project}
          />
        </NotificationActionContent>
      ) : (
        <Fragment>
          <NotificationActionContent>
            {renderIcon()}
            {renderDescription()}
          </NotificationActionContent>
          {renderEditButton()}
        </Fragment>
      )}
    </StyledCard>
  );
}

const StyledCard = styled(Card)`
  padding: ${space(1)} ${space(1.5)};
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const NotificationActionContent = styled('div')`
  display: flex;
  align-items: center;
  > * {
    margin-right: ${space(0.5)};
    margin-left: ${space(0.5)};
  }
`;

export const NotificationRecipient = styled(Badge)`
  border-radius: 5px;
  font-weight: normal;
  margin-right: 4px;
`;

export default NotificationActionItem;
