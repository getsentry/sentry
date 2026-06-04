import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useUpdateAutomation} from 'sentry/views/automations/hooks';
import {
  getNoAlertWritePermissionTooltip,
  useCanEditAutomation,
} from 'sentry/views/automations/hooks/useCanEditAutomation';

type DisabledAlertProps = {
  automation: Automation;
};

/**
 * Alert banner for users to quickly understand that an automation is
 * disabled and not actively running, and give them a one-click way to
 * enable it. The alert automatically hides when the automation is enabled.
 */
export function DisabledAlert({automation}: DisabledAlertProps) {
  const {mutate: updateAutomation, isPending: isEnabling} = useUpdateAutomation();

  const canEdit = useCanEditAutomation();

  if (automation.enabled) {
    return null;
  }

  const handleEnable = () => {
    updateAutomation({
      id: automation.id,
      name: automation.name,
      enabled: true,
    });
  };

  const permissionTooltipText = getNoAlertWritePermissionTooltip();

  return (
    <Alert.Container>
      <Alert
        variant="muted"
        trailingItems={
          <Tooltip
            title={canEdit ? undefined : permissionTooltipText}
            disabled={canEdit}
            isHoverable
          >
            <Button
              size="xs"
              icon={<IconPlay />}
              onClick={handleEnable}
              disabled={isEnabling || !canEdit}
              aria-label={t('Enable')}
            >
              {t('Enable')}
            </Button>
          </Tooltip>
        }
      >
        {t('This alert is disabled and will not send notifications.')}
      </Alert>
    </Alert.Container>
  );
}
