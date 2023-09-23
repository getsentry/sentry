import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  AvailableNotificationAction,
  NotificationAction,
} from 'sentry/types/notificationActions';

type OnCallServiceFormProps = {
  /**
   * Map of pagerduty/opsgenie integration IDs to available actions for those IDs
   */
  Integrations: Record<number, AvailableNotificationAction[]>;
  /**
   * The notification action being represented
   */
  action: Partial<NotificationAction>;
  /**
   * The type of on-call service (Pagerduty or Opsgenie)
   */
  onCallService: string;
  onCancel: () => void;
  onChange: (names: string[], values: any[]) => void;
  onSave: () => void;
};

function OnCallServiceForm({
  action,
  onCallService,
  onCancel,
  onChange,
  onSave,
  Integrations,
}: OnCallServiceFormProps) {
  const [selectedAccount, setSelectedAccount] = useState(
    action.integrationId
      ? Integrations[action.integrationId][0].action.integrationName
      : ''
  );
  const [selectedDisplay, setSelectedDisplay] = useState(action.targetDisplay ?? '');

  const accountOptions: MenuItemProps[] = useMemo(() => {
    return Object.keys(Integrations).map<MenuItemProps>(integrationId => {
      // Get the name of the integration for the integrationId from the first
      // AvailableNotificationAction element in the array
      const integrationName = Integrations[integrationId][0].action.integrationName;
      return {
        key: integrationName,
        label: integrationName,
        onAction: value => {
          onChange(['integrationId'], [integrationId]);
          setSelectedAccount(value);
        },
      };
    });
  }, [Integrations, onChange]);

  // Each Pagerduty/Opsgenie account has its own list of services/teams
  const getServiceOptions = (): MenuItemProps[] => {
    if (!action.integrationId) {
      return [];
    }
    const services = Integrations[action.integrationId];
    return services.map<MenuItemProps>(service => ({
      key: service.action.targetDisplay ?? '',
      label: service.action.targetDisplay,
      onAction: value => {
        onChange(
          ['targetIdentifier', 'targetDisplay'],
          [service.action.targetIdentifier, value]
        );
        setSelectedDisplay(value);
      },
    }));
  };
  const keySelectionText =
    onCallService === 'pagerduty'
      ? t('account with the service')
      : t('account with the team');

  const dropdownText =
    onCallService === 'pagerduty' ? t('Select Service') : t('Select Team');

  return (
    <NotificationActionFormContainer>
      <NotificationActionCell>
        <div>{t('Send a notification to the')}</div>
        <DropdownMenu
          items={accountOptions}
          trigger={(triggerProps, isOpen) => (
            <DropdownButton
              {...triggerProps}
              isOpen={isOpen}
              aria-label={t('Select Account')}
              size="xs"
              data-test-id="on-call-account-dropdown"
            >
              {selectedAccount}
            </DropdownButton>
          )}
        />

        <div>{keySelectionText}</div>

        <DropdownMenu
          items={getServiceOptions()}
          trigger={triggerProps => (
            <DropdownButton
              {...triggerProps}
              aria-label={dropdownText}
              size="xs"
              data-test-id="target-display-dropdown"
            >
              {selectedDisplay}
            </DropdownButton>
          )}
        />
      </NotificationActionCell>

      <ButtonBar gap={0.5}>
        <Button onClick={onCancel} size="xs">
          {t('Cancel')}
        </Button>
        <Button priority="primary" size="xs" onClick={onSave}>
          {t('Save')}
        </Button>
      </ButtonBar>
    </NotificationActionFormContainer>
  );
}

const NotificationActionCell = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${space(0.5)};
`;

const NotificationActionFormContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  width: 100%;
`;

export default OnCallServiceForm;
