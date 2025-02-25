import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Card from 'sentry/components/card';
import {openConfirmModal} from 'sentry/components/confirm';
import Badge from 'sentry/components/core/badge/badge';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import OnCallServiceForm from 'sentry/components/notificationActions/forms/onCallServiceForm';
import SlackForm from 'sentry/components/notificationActions/forms/slackForm';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis, IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {
  AvailableNotificationAction,
  NotificationAction,
} from 'sentry/types/notificationActions';
import {NotificationActionService} from 'sentry/types/notificationActions';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type NotificationActionItemProps = {
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
  onUpdate: (actionId: number, editedAction: NotificationAction) => void;
  /**
   * Map of opsgenie integration IDs to available actions for those IDs
   */
  opsgenieIntegrations: Record<number, AvailableNotificationAction[]>;
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
  disabled?: boolean;
  /**
   * Optional list of roles to display as recipients of Sentry notifications
   */
  recipientRoles?: string[];
};

function NotificationActionItem({
  action,
  index,
  availableActions,
  defaultEdit = false,
  pagerdutyIntegrations,
  opsgenieIntegrations,
  project,
  recipientRoles,
  onDelete,
  onUpdate,
  disabled = false,
}: NotificationActionItemProps) {
  const [isEditing, setIsEditing] = useState(defaultEdit);
  const [editedAction, setEditedAction] = useState(action);
  const serviceType = action.serviceType;
  const api = useApi();
  const organization = useOrganization();

  const renderIcon = () => {
    switch (serviceType) {
      // Currently email and Sentry notification use the same icon
      case NotificationActionService.EMAIL:
      case NotificationActionService.SENTRY_NOTIFICATION:
        return <IconMail size="sm" />;
      default:
        return <PluginIcon pluginId={serviceType} size={16} />;
    }
  };

  const renderDescription = () => {
    switch (serviceType) {
      case NotificationActionService.SENTRY_NOTIFICATION:
        return (
          <Fragment>
            <div>{t('Send an email notification to the following roles')}</div>
            {recipientRoles?.map(role => (
              <NotificationRecipient key={role}>{role}</NotificationRecipient>
            ))}
          </Fragment>
        );
      case NotificationActionService.SLACK:
        return (
          <Fragment>
            <div>{t('Send a notification to the')}</div>
            <NotificationRecipient>{action.targetDisplay}</NotificationRecipient>
            <div>{t('channel')}</div>
          </Fragment>
        );
      case NotificationActionService.PAGERDUTY:
        return (
          <Fragment>
            <div>{t('Send a notification to the')}</div>
            <NotificationRecipient>{action.targetDisplay}</NotificationRecipient>
            <div>{t('service')}</div>
          </Fragment>
        );
      case NotificationActionService.OPSGENIE:
        return (
          <Fragment>
            <div>{t('Send a notification to the')}</div>
            <NotificationRecipient>{action.targetDisplay}</NotificationRecipient>
            <div>{t('team')}</div>
          </Fragment>
        );
      default:
        // TODO(enterprise): descriptions for email, msteams, sentry_app
        return null;
    }
  };

  const handleDelete = async () => {
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
  };

  const handleCancel = () => {
    if (action.id) {
      setEditedAction(action);
      setIsEditing(false);
      return;
    }
    // Delete the unsaved notification action
    onDelete(index);
  };

  const handleSave = async () => {
    const {apiMethod, apiEndpoint, successMessage, errorMessage} = getFormData();
    addLoadingMessage();
    // TODO(enterprise): use "requires" to get data to send
    // This is currently optimized for spike protection
    const data = {...editedAction};

    // Remove keys from the data if they are falsy
    Object.keys(data).forEach(key => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (!data[key]) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        delete data[key];
      }
    });

    try {
      const resp = await api.requestPromise(apiEndpoint, {
        method: apiMethod,
        data: {...data, projects: [project.slug]},
      });
      addSuccessMessage(successMessage);
      onUpdate(index, resp);
      setEditedAction(resp);
      setIsEditing(false);
    } catch (err) {
      addErrorMessage(errorMessage);
    }
  };

  // Used for PagerDuty/Opsgenie
  const handleChange = (names: string[], values: any[]) => {
    const updatedAction = {...editedAction};
    names.forEach((name, i) => {
      const value = values[i];
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      updatedAction[name] = value;
    });
    setEditedAction(updatedAction);
  };

  // Edit button is located outside of the form
  const renderEditButton = () => {
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
      <Tooltip
        disabled={!disabled}
        title={t('You do not have permission to edit notification actions.')}
      >
        <DropdownMenu
          items={menuItems}
          trigger={triggerProps => (
            <Button
              {...triggerProps}
              aria-label={t('Actions')}
              size="xs"
              icon={<IconEllipsis direction="down" size="sm" />}
              data-test-id="edit-dropdown"
            />
          )}
          isDisabled={disabled}
        />
      </Tooltip>
    );
  };

  const getFormData = () => {
    if (editedAction.id) {
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
  };

  const renderNotificationActionForm = () => {
    switch (serviceType) {
      case NotificationActionService.SENTRY_NOTIFICATION:
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
      case NotificationActionService.SLACK:
        return (
          <SlackForm
            action={editedAction}
            onChange={(name: string, value: any) =>
              setEditedAction({...editedAction, [name]: value})
            }
            onSave={handleSave}
            onCancel={handleCancel}
            availableActions={availableActions}
          />
        );
      case NotificationActionService.PAGERDUTY:
        return (
          <OnCallServiceForm
            action={editedAction}
            onChange={handleChange}
            onSave={handleSave}
            onCancel={handleCancel}
            Integrations={pagerdutyIntegrations}
            onCallService="pagerduty"
          />
        );
      case NotificationActionService.OPSGENIE:
        return (
          <OnCallServiceForm
            action={editedAction}
            onChange={handleChange}
            onSave={handleSave}
            onCancel={handleCancel}
            Integrations={opsgenieIntegrations}
            onCallService="opsgenie"
          />
        );
      default:
        return null;
    }
  };

  return (
    <StyledCard isEditing={isEditing} data-test-id="notification-action">
      {isEditing ? (
        <NotificationActionContainer data-test-id={`${serviceType}-form`}>
          <IconContainer>{renderIcon()}</IconContainer>
          {renderNotificationActionForm()}
        </NotificationActionContainer>
      ) : (
        <Fragment>
          <NotificationActionContainer data-test-id={`${serviceType}-action`}>
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
  border-radius: ${p => p.theme.borderRadius};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

export default NotificationActionItem;
