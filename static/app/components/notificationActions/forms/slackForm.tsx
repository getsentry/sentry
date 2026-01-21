import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Input} from 'sentry/components/core/input';
import DropdownButton from 'sentry/components/dropdownButton';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
// import {
//   NotificationActionCell,
//   NotificationActionFormContainer,
// } from 'sentry/components/notificationActions/notificationActionItem';
import {t} from 'sentry/locale';
import type {
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
        onAction: () => {
          onChange('integrationId', service.action.integrationId);
          setSelectedWorkspace(service.action.integrationName ?? '');
        },
      }))
      .filter(option => option.label);
  }, [availableActions, onChange]);

  return (
    <Flex justify="between" width="100%">
      <Flex align="center" wrap="wrap" gap="xs">
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
      </Flex>

      <ButtonBar gap="xs">
        <Button onClick={onCancel} size="xs">
          {t('Cancel')}
        </Button>
        <Button priority="primary" size="xs" onClick={onSave}>
          {t('Save')}
        </Button>
      </ButtonBar>
    </Flex>
  );
}

const StyledInput = styled(Input)`
  width: 100px;
`;

export default SlackForm;
