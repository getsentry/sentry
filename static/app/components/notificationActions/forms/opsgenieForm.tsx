import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
// import {
//   NotificationActionCell,
//   NotificationActionFormContainer,
// } from 'sentry/components/notificationActions/notificationActionItem';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  AvailableNotificationAction,
  NotificationAction,
} from 'sentry/types/notificationActions';

type OpsgenieFormProps = {
  /**
   * The notification action being represented
   */
  action: Partial<NotificationAction>;
  onCancel: () => void;
  onChange: (names: string[], values: any[]) => void;
  onSave: () => void;
  /**
   * Map of pagerduty integration IDs to available actions for those IDs
   */
  opsgenieIntegrations: Record<number, AvailableNotificationAction[]>;
};

function OpsgenieForm({
  action,
  onCancel,
  onChange,
  onSave,
  opsgenieIntegrations,
}: OpsgenieFormProps) {
  const [selectedAccount, setSelectedAccount] = useState(
    action.integrationId
      ? opsgenieIntegrations[action.integrationId][0].action.integrationName
      : ''
  );
  const [selectedDisplay, setSelectedDisplay] = useState(action.targetDisplay ?? '');

  const accountOptions: MenuItemProps[] = useMemo(() => {
    return Object.keys(opsgenieIntegrations).map<MenuItemProps>(integrationId => {
      const integrationName =
        opsgenieIntegrations[integrationId][0].action.integrationName;
      return {
        key: integrationName,
        label: integrationName,
        onAction: value => {
          onChange(['integrationId'], [integrationId]);
          setSelectedAccount(value);
        },
      };
    });
  }, [opsgenieIntegrations, onChange]);

  const getTeamOptions = (): MenuItemProps[] => {
    if (!action.integrationId) {
      return [];
    }
    const teams = opsgenieIntegrations[action.integrationId];
    return teams.map<MenuItemProps>(team => ({
      key: team.action.targetDisplay ?? '',
      label: team.action.targetDisplay,
      onAction: value => {
        onChange(
          ['targetIdentifier', 'targetDisplay'],
          [team.action.targetIdentifier, value]
        );
        setSelectedDisplay(value);
      },
    }));
  };

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
              data-test-id="opsgenie-account-dropdown"
            >
              {selectedAccount}
            </DropdownButton>
          )}
        />

        <div>{t('account with the key')}</div>

        <DropdownMenu
          items={getTeamOptions()}
          trigger={triggerProps => (
            <DropdownButton
              {...triggerProps}
              aria-label={t('Select Key')}
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

export default OpsgenieForm;
