import {hasEveryAccess} from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import useOrganization from 'sentry/utils/useOrganization';
import {useUpdateAutomation} from 'sentry/views/automations/hooks';

type DisabledAlertProps = {
  automation: Automation;
};

/**
 * Alert banner for users to quickly understand that an automation is
 * disabled and not actively running, and give them a one-click way to
 * enable it. The alert automatically hides when the automation is enabled.
 */
export function DisabledAlert({automation}: DisabledAlertProps) {
  const organization = useOrganization();
  const {mutate: updateAutomation, isPending: isEnabling} = useUpdateAutomation();

  const canEdit = hasEveryAccess(['alerts:write'], {organization});

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

  return (
    <Alert.Container>
      <Alert
        type="muted"
        trailingItems={
          <Button
            size="xs"
            icon={<IconPlay />}
            onClick={handleEnable}
            disabled={isEnabling || !canEdit}
            aria-label={t('Enable')}
            title={
              canEdit ? undefined : t('You do not have permission to enable this alert')
            }
          >
            {t('Enable')}
          </Button>
        }
      >
        {t('This alert is disabled and will not send notifications.')}
      </Alert>
    </Alert.Container>
  );
}
