import {Fragment, useMemo, useState} from 'react';
import capitalize from 'lodash/capitalize';

import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import NotificationActionItem from 'sentry/components/notificationActions/notificationActionItem';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {
  AvailableNotificationAction,
  NotificationAction,
  NotificationActionService,
} from 'sentry/types/notificationActions';

type NotificationActionManagerProps = {
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
  disabled?: boolean;
  /**
   * Optional list of roles to display as recipients of Sentry notifications
   */
  recipientRoles?: string[];
};

function NotificationActionManager({
  actions,
  availableActions,
  recipientRoles,
  project,
  updateAlertCount = () => {},
  disabled = false,
}: NotificationActionManagerProps) {
  const [notificationActions, setNotificationActions] =
    useState<Partial<NotificationAction>[]>(actions);

  const removeNotificationAction = (index: number) => {
    // Removes notif action from state using the index
    const updatedActions = [...notificationActions];
    updatedActions.splice(index, 1);
    setNotificationActions(updatedActions);
    updateAlertCount(parseInt(project.id, 10), updatedActions.length);
  };

  const updateNotificationAction = (index: number, updatedAction: NotificationAction) => {
    // Updates notif action from state using the index
    const updatedActions = [...notificationActions];
    updatedActions.splice(index, 1, updatedAction);
    setNotificationActions(updatedActions);
  };

  // Lists the available actions for each service
  const availableServices: Record<
    NotificationActionService,
    AvailableNotificationAction[]
  > = useMemo(() => {
    const availableServicesMap: Record<
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
      availableServicesMap[a.action.serviceType as NotificationActionService].push(a);
    });
    return availableServicesMap;
  }, [availableActions]);

  // Groups the notification actions together by service
  // Will render the notif actions in the order the keys are listed in
  const actionsMap: Record<
    NotificationActionService,
    {action: NotificationAction; index: number}[]
  > = useMemo(() => {
    const notificationActionsMap: Record<
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
        notificationActionsMap[action.serviceType].push({action, index});
      }
    });
    return notificationActionsMap;
  }, [notificationActions]);

  // Groups the pagerduty integrations with their corresponding allowed services
  const pagerdutyIntegrations: Record<number, AvailableNotificationAction[]> =
    useMemo(() => {
      const integrations: Record<number, AvailableNotificationAction[]> = {};
      availableServices[NotificationActionService.PAGERDUTY].forEach(service => {
        const integrationId = service.action.integrationId;
        if (integrationId) {
          if (integrationId in integrations) {
            integrations[integrationId].push(service);
          } else {
            integrations[integrationId] = [service];
          }
        }
      });
      return integrations;
    }, [availableServices]);

  const renderNotificationActions = () => {
    if (!notificationActions) {
      return [];
    }

    // Renders the notif actions grouped together by kind
    return Object.keys(actionsMap).map(serviceType => {
      const services = actionsMap[serviceType];
      return services.map(({action, index}) => (
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
          disabled={disabled}
        />
      ));
    });
  };

  const getMenuItems = () => {
    const menuItems: MenuItemProps[] = [];
    Object.entries(availableServices).forEach(([serviceType, validActions]) => {
      if (validActions.length === 0) {
        return;
      }
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
        onAction: () => {
          // Add notification action
          const updatedActions = [...notificationActions, validActions[0].action];
          setNotificationActions(updatedActions);
          updateAlertCount(parseInt(project.id, 10), updatedActions.length);
        },
      });
    });
    return menuItems;
  };

  const addAlertButton = (
    <Tooltip
      disabled={!disabled}
      title={t('You do not have permission to add notification actions for this project')}
    >
      <DropdownMenu
        items={getMenuItems()}
        trigger={triggerProps => (
          <DropdownButton
            {...triggerProps}
            aria-label={t('Add Action')}
            size="xs"
            icon={<IconAdd isCircled color="gray300" />}
            disabled={disabled}
          >
            {t('Add Action')}
          </DropdownButton>
        )}
        isDisabled={disabled}
        data-test-id="add-action-button"
      />
    </Tooltip>
  );

  return (
    <Fragment>
      {renderNotificationActions()}
      {addAlertButton}
    </Fragment>
  );
}

export default NotificationActionManager;
