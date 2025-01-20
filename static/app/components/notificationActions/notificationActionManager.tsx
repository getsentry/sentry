import {Fragment, useEffect, useMemo, useState} from 'react';

import DropdownButton from 'sentry/components/dropdownButton';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import NotificationActionItem from 'sentry/components/notificationActions/notificationActionItem';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  AvailableNotificationAction,
  NotificationAction,
} from 'sentry/types/notificationActions';
import {NotificationActionService} from 'sentry/types/notificationActions';
import type {Project} from 'sentry/types/project';
import {capitalize} from 'sentry/utils/string/capitalize';

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
  disabled?: boolean;
  /**
   * Optional list of roles to display as recipients of Sentry notifications
   */
  recipientRoles?: string[];
  /**
   * Updates the notification alert count for this project
   */
  updateAlertCount?: (projectId: number, alertCount: number) => void;
};

function NotificationActionManager({
  actions,
  availableActions,
  recipientRoles,
  project,
  disabled = false,
}: NotificationActionManagerProps) {
  const [notificationActions, setNotificationActions] =
    useState<Partial<NotificationAction>[]>(actions);

  useEffect(() => {
    setNotificationActions(actions);
  }, [actions]);

  const removeNotificationAction = (index: number) => {
    // Removes notif action from state using the index
    const updatedActions = [...notificationActions];
    updatedActions.splice(index, 1);
    setNotificationActions(updatedActions);
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
      [NotificationActionService.OPSGENIE]: [],
      [NotificationActionService.DISCORD]: [],
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
      [NotificationActionService.OPSGENIE]: [],
      [NotificationActionService.DISCORD]: [],
    };
    notificationActions.forEach((action, index) => {
      if (action.serviceType) {
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
            integrations[integrationId]!.push(service);
          } else {
            integrations[integrationId] = [service];
          }
        }
      });
      return integrations;
    }, [availableServices]);

  const opsgenieIntegrations: Record<number, AvailableNotificationAction[]> =
    useMemo(() => {
      const integrations: Record<number, AvailableNotificationAction[]> = {};
      availableServices[NotificationActionService.OPSGENIE].forEach(team => {
        const integrationId = team.action.integrationId;
        if (integrationId) {
          if (integrationId in integrations) {
            integrations[integrationId]!.push(team);
          } else {
            integrations[integrationId] = [team];
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
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const services = actionsMap[serviceType];
      return services.map(({action, index}: any) => (
        <NotificationActionItem
          key={index}
          index={index}
          defaultEdit={!action.id}
          action={action}
          recipientRoles={recipientRoles}
          // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          availableActions={availableServices[serviceType]}
          opsgenieIntegrations={opsgenieIntegrations}
          pagerdutyIntegrations={pagerdutyIntegrations}
          project={project}
          onDelete={removeNotificationAction}
          onUpdate={updateNotificationAction}
          disabled={disabled}
        />
      ));
    });
  };
  const getLabel = (serviceType: string) => {
    switch (serviceType) {
      case NotificationActionService.SENTRY_NOTIFICATION:
        return t('Send a Sentry notification');
      case NotificationActionService.OPSGENIE:
        return t('Send an Opsgenie notification');
      default:
        return t('Send a %s notification', capitalize(serviceType));
    }
  };

  const menuItems = useMemo(() => {
    const dropdownMenuItems: MenuItemProps[] = [];
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
      const label = getLabel(serviceType);
      dropdownMenuItems.push({
        key: serviceType,
        label,
        onAction: () => {
          // Add notification action
          const updatedActions = [...notificationActions, validActions[0]!.action];
          setNotificationActions(updatedActions);
        },
      });
    });
    return dropdownMenuItems;
  }, [actionsMap, availableServices, notificationActions]);

  let toolTipText: undefined | string = undefined;
  if (disabled) {
    toolTipText = t(
      'You do not have permission to add notification actions for this project'
    );
  } else if (menuItems.length === 0) {
    toolTipText = t('You do not have any notification actions to add');
  }

  const isAddAlertDisabled = disabled || menuItems.length === 0;

  const addAlertButton = (
    <Tooltip disabled={!isAddAlertDisabled} title={toolTipText}>
      <DropdownMenu
        items={menuItems}
        trigger={(triggerProps, isOpen) => (
          <DropdownButton
            {...triggerProps}
            isOpen={isOpen}
            aria-label={t('Add Action')}
            size="xs"
            icon={<IconAdd isCircled color="gray300" />}
            disabled={isAddAlertDisabled}
          >
            {t('Add Action')}
          </DropdownButton>
        )}
        isDisabled={isAddAlertDisabled}
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
