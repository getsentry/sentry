import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';

interface Props {
  automation: Automation;
}

export default function AutomationTitleCell({automation}: Props) {
  const organization = useOrganization();

  const allActions = automation.actionFilters.flatMap(filter => filter.actions ?? []);
  const inactiveCount = allActions.filter(action => action.status === 'disabled').length;
  const totalCount = allActions.length;

  const warning = getWarning({inactiveCount, totalCount});

  return (
    <TitleCell
      name={automation.name}
      link={makeAutomationDetailsPathname(organization.slug, automation.id)}
      systemCreated={!automation.createdBy}
      disabled={!automation.enabled}
      warning={warning}
    />
  );
}

function getWarning({
  inactiveCount,
  totalCount,
}: {
  inactiveCount: number;
  totalCount: number;
}) {
  if (totalCount === 0) {
    return {
      color: 'danger' as const,
      message: t('You must add an action for this automation to run.'),
    };
  }
  if (inactiveCount === totalCount) {
    return {
      color: 'danger' as const,
      message: t(
        'Automation is invalid because no actions can run. Actions need to be reconfigured.'
      ),
    };
  }
  if (inactiveCount > 0) {
    return {
      color: 'warning' as const,
      message: t('One or more actions need to be reconfigured in order to run.'),
    };
  }
  return null;
}
