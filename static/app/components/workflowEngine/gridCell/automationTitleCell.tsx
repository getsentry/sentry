import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import useOrganization from 'sentry/utils/useOrganization';
import {getAutomationActionsWarning} from 'sentry/views/automations/hooks/utils';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';

interface Props {
  automation: Automation;
}

export default function AutomationTitleCell({automation}: Props) {
  const organization = useOrganization();

  const allActions = automation.actionFilters.flatMap(filter => filter.actions ?? []);
  const inactiveCount = allActions.filter(action => action.status === 'disabled').length;
  const totalCount = allActions.length;

  const warning = getAutomationActionsWarning({inactiveCount, totalCount});

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
