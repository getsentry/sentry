import {hasEveryAccess} from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconPlay} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
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

  const permissionTooltipText = tct(
    'You do not have permission to edit this alert. Ask your organization owner or manager to [settingsLink:enable alert access] for you.',
    {
      settingsLink: (
        <Link
          to={{
            pathname: `/settings/${organization.slug}/`,
            hash: 'alertsMemberWrite',
          }}
        />
      ),
    }
  );

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
