import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Badge from 'sentry/components/badge';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Card from 'sentry/components/card';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import PagerdutyForm from 'sentry/components/notificationActions/forms/pagerdutyForm';
import SlackForm from 'sentry/components/notificationActions/forms/slackForm';
import {IconEllipsis, IconMail} from 'sentry/icons';
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
   * The available actions for the action's serviceType
   * (serviceType as in "slack", "pagerduty")
   */
  availableActions: AvailableNotificationAction[];
  /**
   * The notif action's index in the parent component (NotificationActionManager)
   */
  index: number;
  /**
   * Update state in the parent component upon deleting this notification action
   */
  onDelete: (actionId: number) => void;
  /**
   * Update state in the parent component upon updating this notification action
   */
  onUpdate: (actionId: number, updatedAction: NotificationAction) => void;
  /**
   * Map of pagerduty integration IDs to available actions for those IDs
   */
  pagerdutyIntegrations: Record<number, AvailableNotificationAction[]>;
  project: Project;
  /**
   * Whether to initially display edit mode
   * Set to "true" when adding a new notification action
   */
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
  const [updatedAction, setUpdatedAction] = useState(action);
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
    // TODO(enterprise): descriptions for email, msteams, sentry_app
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

  function handleCancel() {
    if (action.id) {
      setIsEditing(false);
      return;
    }
    // Delete the unsaved notification action
    onDelete(index);
  }

  async function handleSave() {
    const formProps = getFormProps();
    addLoadingMessage();
    // TODO(enterprise): use "requires" to get data to send
    // This is currently optimized for spike protection
    const data = cloneDeep(updatedAction);

    // Remove keys from the data if they are falsy
    Object.keys(data).forEach(key => {
      if (!data[key]) {
        delete data[key];
      }
    });

    try {
      const resp = await api.requestPromise(formProps.apiEndpoint, {
        method: formProps.apiMethod,
        data: {...data, projects: [project.slug]},
      });
      addSuccessMessage(formProps.successMessage);
      onUpdate(index, resp);
      setUpdatedAction(resp);
      setIsEditing(false);
    } catch (err) {
      addErrorMessage(formProps.errorMessage);
    }
  }

  function handleChange(name: string, value: any) {
    const modifiedAction = cloneDeep(updatedAction);
    modifiedAction[name] = value;
    setUpdatedAction(modifiedAction);
  }

  // Edit button is located outside of the form
  function renderEditButton() {
    const menuItems: MenuItemProps[] = [
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

    // No edit mode for Sentry notifications
    if (serviceType !== NotificationActionService.SENTRY_NOTIFICATION) {
      menuItems.unshift({
        key: 'notificationaction-edit',
        label: t('Edit'),
        onAction: () => setIsEditing(true),
      });
    }

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

  function getFormProps() {
    if (updatedAction.id) {
      return {
        apiMethod: 'PUT' as const,
        apiEndpoint: `/organizations/${organization.slug}/notifications/actions/${action.id}/`,
        successMessage: t('Successfully updated notification action'),
        errorMessage: t('Unable to update notification action'),
      };
    }
    return {
      apiMethod: 'POST' as const,
      apiEndpoint: `/organizations/${organization.slug}/notifications/actions/`,
      successMessage: t('Successfully added notification action'),
      errorMessage: t('Unable to add notification action'),
    };
  }

  function renderNotificationActionForm() {
    if (serviceType === NotificationActionService.SENTRY_NOTIFICATION) {
      // No form for Sentry notifications, just Cancel + Save buttons
      return (
        <NotificationActionFormContainer>
          <NotificationActionCell>{renderDescription()}</NotificationActionCell>
          <ButtonBar gap={0.5}>
            <Button onClick={handleCancel} size="xs">
              {t('Cancel')}
            </Button>
            <Button priority="primary" size="xs" onClick={handleSave}>
              {t('Save')}
            </Button>
          </ButtonBar>
        </NotificationActionFormContainer>
      );
    }
    if (serviceType === NotificationActionService.SLACK) {
      return (
        <SlackForm
          action={updatedAction}
          onChange={handleChange}
          onSave={handleSave}
          onCancel={handleCancel}
          availableActions={availableActions}
        />
      );
    }
    if (serviceType === NotificationActionService.PAGERDUTY) {
      return (
        <PagerdutyForm
          action={updatedAction}
          onChange={handleChange}
          onSave={handleSave}
          onCancel={handleCancel}
          pagerdutyIntegrations={pagerdutyIntegrations}
        />
      );
    }
    // TODO(enterprise): forms for email, msteams, sentry_app
    return null;
  }

  return (
    <StyledCard isEditing={isEditing}>
      {isEditing ? (
        <NotificationActionContainer>
          <IconContainer>{renderIcon()}</IconContainer>
          {renderNotificationActionForm()}
        </NotificationActionContainer>
      ) : (
        <Fragment>
          <NotificationActionContainer>
            <IconContainer>{renderIcon()}</IconContainer>
            <NotificationActionCell>{renderDescription()}</NotificationActionCell>
          </NotificationActionContainer>
          {renderEditButton()}
        </Fragment>
      )}
    </StyledCard>
  );
}

const StyledCard = styled(Card)<{isEditing: boolean}>`
  padding: ${space(1)} ${space(1.5)};
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  background-color: ${props => (props.isEditing ? props.theme.surface200 : 'inherit')};
`;

const IconContainer = styled('div')`
  margin-right: ${space(1)};
  display: flex;
  align-items: center;
`;

const NotificationActionContainer = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
`;

export const NotificationActionCell = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${space(0.5)};
`;

export const NotificationActionFormContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  width: 100%;
`;

const NotificationRecipient = styled(Badge)`
  border-radius: 5px;
  font-weight: normal;
`;

export default NotificationActionItem;
