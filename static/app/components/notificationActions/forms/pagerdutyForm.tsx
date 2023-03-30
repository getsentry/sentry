import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
// import {
//   NotificationActionCell,
//   NotificationActionFormContainer,
// } from 'sentry/components/notificationActions/notificationActionItem';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  AvailableNotificationAction,
  NotificationAction,
} from 'sentry/types/notificationActions';

type PagerdutyFormProps = {
  /**
   * The notification action being represented
   */
  action: Partial<NotificationAction>;
  onCancel: () => void;
  onChange: (name: string, value: any) => void;
  onSave: () => void;
  /**
   * Map of pagerduty integration IDs to available actions for those IDs
   */
  pagerdutyIntegrations: Record<number, AvailableNotificationAction[]>;
};

const PagerdutyForm = ({
  action,
  onCancel,
  onChange,
  onSave,
  pagerdutyIntegrations,
}: PagerdutyFormProps) => {
  const [selectedAccount, setSelectedAccount] = useState(
    action.integrationId
      ? pagerdutyIntegrations[action.integrationId][0].action.integrationName
      : ''
  );
  const [selectedDisplay, setSelectedDisplay] = useState(action.targetDisplay ?? '');

  const accountOptions = useMemo(() => {
    return Object.keys(pagerdutyIntegrations).map<MenuItemProps>(integrationId => {
      // Get the name of the integration for the integrationId from the first
      // AvailableNotificationAction element in the array
      const integrationName =
        pagerdutyIntegrations[integrationId][0].action.integrationName;
      return {
        key: integrationName,
        label: integrationName,
        onAction: value => {
          onChange('integrationId', integrationId);
          setSelectedAccount(value);
        },
      };
    });
  }, [pagerdutyIntegrations, onChange]);

  // Each Pagerduty account has its own list of services
  const getServiceOptions = (): MenuItemProps[] => {
    if (!action.integrationId) {
      return [];
    }
    const services = pagerdutyIntegrations[action.integrationId];
    return services.map<MenuItemProps>(service => ({
      key: service.action.targetDisplay ?? '',
      label: service.action.targetDisplay,
      onAction: value => {
        onChange('targetDisplay', service.action.targetDisplay);
        onChange('targetIdentifier', service.action.targetIdentifier);
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
          trigger={triggerProps => (
            <Button {...triggerProps} aria-label={t('Selected Account')} size="xs">
              {selectedAccount}
              <StyledIconChevron direction="down" />
            </Button>
          )}
        />

        <div>{t('account with the service')}</div>

        <DropdownMenu
          items={getServiceOptions()}
          trigger={triggerProps => (
            <Button {...triggerProps} aria-label={t('Selected Service')} size="xs">
              {selectedDisplay}
              <StyledIconChevron direction="down" />
            </Button>
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
};

const StyledIconChevron = styled(IconChevron)`
  margin-left: ${space(1)};
`;

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

export default PagerdutyForm;
