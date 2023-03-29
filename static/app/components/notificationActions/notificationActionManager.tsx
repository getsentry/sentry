import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';
import cloneDeep from 'lodash/cloneDeep';

import {Button} from 'sentry/components/button';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import NotificationActionItem from 'sentry/components/notificationActions/notificationActionItem';
import {IconAdd, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {
  AvailableNotificationAction,
  NotificationAction,
  NotificationActionService,
} from 'sentry/types/notificationActions';

interface NotificationActionManagerProps {
  /**
   * The list of existing notification actions
   */
  actions: NotificationAction[];
  /**
   * The list of available notification actions
   */
  availableActions: AvailableNotificationAction[];
  /**
   * The project associated with the notification actions
   * TODO(enterprise): refactor to account for multiple projects
   */
  project: Project;
  /**
   * Updates the notification alert count for this project
   */
  updateAlertCount: (projectId: number, alertCount: number) => void;
  /**
   * Optional list of roles to display as recipients of Sentry notifications
   */
  recipientRoles?: string[];
}

function NotificationActionManager({
  actions,
  availableActions,
  recipientRoles,
  project,
  updateAlertCount,
}: NotificationActionManagerProps) {
  const [notificationActions, setNotificationActions] =
    useState<Partial<NotificationAction>[]>(actions);

  // Lists the available actions for each service
  const availableServices: Record<
    NotificationActionService,
    AvailableNotificationAction[]
  > = {
    [NotificationActionService.SENTRY_NOTIFICATION]: [],
    [NotificationActionService.EMAIL]: [],
    [NotificationActionService.SLACK]: [],
    [NotificationActionService.PAGERDUTY]: [],
    [NotificationActionService.MSTEAMS]: [],
    [NotificationActionService.SENTRY_APP]: [],
  };
  availableActions.forEach(a => {
    availableServices[a.action.serviceType as NotificationActionService].push(a);
  });

  // Groups the notification actions together by service
  // Will render the notif actions in the order the keys are listed in
  const actionsMap: Record<
    NotificationActionService,
    {action: NotificationAction; index: number}[]
  > = {
    [NotificationActionService.SENTRY_NOTIFICATION]: [],
    [NotificationActionService.EMAIL]: [],
    [NotificationActionService.SLACK]: [],
    [NotificationActionService.PAGERDUTY]: [],
    [NotificationActionService.MSTEAMS]: [],
    [NotificationActionService.SENTRY_APP]: [],
  };
  notificationActions.forEach((action, index) => {
    if (action.serviceType) {
      actionsMap[action.serviceType].push({action, index});
    }
  });

  // Groups the pagerduty integrations with their corresponding allowed services
  const pagerdutyIntegrations: Record<number, AvailableNotificationAction[]> = {};
  availableServices[NotificationActionService.PAGERDUTY].forEach(service => {
    const integrationId = service.action.integrationId;
    if (integrationId) {
      if (integrationId in pagerdutyIntegrations) {
        pagerdutyIntegrations[integrationId].push(service);
      } else {
        pagerdutyIntegrations[integrationId] = [service];
      }
    }
  });

  function renderNotificationActions() {
    if (!notificationActions) {
      return null;
    }

    const serviceActions: NotificationAction[] = [];

    // Renders the notif actions grouped together by kind
    Object.keys(actionsMap).forEach(serviceType => {
      const services = actionsMap[serviceType];
      serviceActions.push(
        services.map(({action, index}) => (
          <NotificationActionItem
            key={index}
            index={index}
            defaultEdit={!action.id}
            action={action}
            recipientRoles={recipientRoles}
            availableActions={availableServices[serviceType]}
            pagerdutyIntegrations={pagerdutyIntegrations}
            project={project}
            onDelete={removeNotificationAction}
            onUpdate={updateNotificationAction}
          />
        ))
      );
    });
    return serviceActions;
  }

  function addNotificationAction(actionInstance: AvailableNotificationAction['action']) {
    const updatedActions = cloneDeep(notificationActions);
    updatedActions.push(actionInstance);
    setNotificationActions(updatedActions);
    updateAlertCount(parseInt(project.id, 10), updatedActions.length);
  }

  function removeNotificationAction(index: number) {
    // Removes notif action from state using the index
    const updatedActions = cloneDeep(notificationActions);
    updatedActions.splice(index, 1);
    setNotificationActions(updatedActions);
    updateAlertCount(parseInt(project.id, 10), updatedActions.length);
  }

  function updateNotificationAction(index: number, updatedAction: NotificationAction) {
    // Updates notif action from state using the index
    const updatedActions = cloneDeep(notificationActions);
    updatedActions.splice(index, 1, updatedAction);
    setNotificationActions(updatedActions);
  }

  // The dropdown items for "Add Alert"
  const getMenuItems = (): MenuItemProps[] => {
    const menuItems: MenuItemProps[] = [];
    Object.entries(availableServices).forEach(entry => {
      const [serviceType, validActions] = entry;
      if (validActions.length > 0) {
        // Cannot have more than one Sentry notification
        if (
          serviceType === NotificationActionService.SENTRY_NOTIFICATION &&
          actionsMap[serviceType].length === 1
        ) {
          return;
        }

        menuItems.push({
          key: serviceType,
          label: t(
            'Send a %s notification',
            serviceType !== NotificationActionService.SENTRY_NOTIFICATION
              ? capitalize(serviceType)
              : 'Sentry'
          ),
          onAction: () => addNotificationAction(validActions[0].action),
        });
      }
    });
    return menuItems;
  };

  function renderAddAlertButton() {
    return (
      <DropdownMenu
        items={getMenuItems()}
        trigger={triggerProps => (
          <Button
            {...triggerProps}
            aria-label={t('Add Alert')}
            size="xs"
            icon={<IconAdd isCircled color="gray300" />}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();

              triggerProps.onClick?.(e);
            }}
          >
            {t('Add Action')}
            <StyledIconChevron direction="down" />
          </Button>
        )}
      />
    );
  }

  return (
    <Fragment>
      {renderNotificationActions()}
      {renderAddAlertButton()}
    </Fragment>
  );
}

const StyledIconChevron = styled(IconChevron)`
  margin-left: ${space(1)};
`;

export default NotificationActionManager;
