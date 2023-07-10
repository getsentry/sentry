import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import Input from 'sentry/components/input';
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

type SlackFormProps = {
  /**
   * The notification action being represented
   */
  action: Partial<NotificationAction>;
  /**
   * The available actions for the action's serviceType (e.g. "slack", "pagerduty")
   */
  availableActions: AvailableNotificationAction[];
  onCancel: () => void;
  onChange: (name: string, value: any) => void;
  onSave: () => void;
};

function SlackForm({
  action,
  availableActions,
  onChange,
  onSave,
  onCancel,
}: SlackFormProps) {
  // Maps integrationId to integrationName
  const availableWorkspaces: Record<number, string> = useMemo(() => {
    const workspacesMap: Record<number, string> = {};
    availableActions.forEach(service => {
      if (service.action.integrationId && service.action.integrationName) {
        workspacesMap[service.action.integrationId] = service.action.integrationName;
      }
    });
    return workspacesMap;
  }, [availableActions]);

  const [selectedWorkspace, setSelectedWorkspace] = useState(
    action.integrationId ? availableWorkspaces[action.integrationId] : ''
  );

  const workspaceOptions: MenuItemProps[] = useMemo(() => {
    return availableActions
      .map<MenuItemProps>(service => ({
        key: service.action.integrationName ?? '',
        label: service.action.integrationName ?? '',
        onAction: value => {
          onChange('integrationId', service.action.integrationId);
          setSelectedWorkspace(value);
        },
      }))
      .filter(option => option.label);
  }, [availableActions, onChange]);

  return (
    <NotificationActionFormContainer>
      <NotificationActionCell>
        <div>{t('Send a notification to the')}</div>
        <DropdownMenu
          items={workspaceOptions}
          trigger={(triggerProps, isOpen) => (
            <DropdownButton
              {...triggerProps}
              isOpen={isOpen}
              size="xs"
              aria-label={t('Select Workspace')}
              data-test-id="slack-workspace-dropdown"
            >
              {selectedWorkspace}
            </DropdownButton>
          )}
        />

        <div>{t('workspace for the channel')}</div>
        <StyledInput
          type="text"
          name="targetDisplay"
          placeholder={t('required')}
          value={action.targetDisplay ?? ''}
          size="xs"
          onChange={e => onChange('targetDisplay', e.target.value)}
          data-test-id="target-display-input"
        />

        <div>{t('(with the channel id)')}</div>
        <StyledInput
          type="text"
          name="targetIdentifier"
          placeholder={t('optional')}
          value={action.targetIdentifier ?? ''}
          size="xs"
          onChange={e => onChange('targetIdentifier', e.target.value)}
          data-test-id="target-identifier-input"
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

const StyledInput = styled(Input)`
  width: 100px;
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

export default SlackForm;
