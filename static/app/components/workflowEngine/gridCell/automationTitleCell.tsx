import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import useOrganization from 'sentry/utils/useOrganization';
import {getAutomationActionsWarning} from 'sentry/views/automations/hooks/utils';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';
import {useMonitorViewContext} from 'sentry/views/detectors/monitorViewContext';

interface Props {
  automation: Automation;
  openInNewTab?: boolean;
}

export default function AutomationTitleCell({automation, openInNewTab}: Props) {
  const organization = useOrganization();
  const {automationsLinkPrefix} = useMonitorViewContext();

  const warning = getAutomationActionsWarning(automation);

  return (
    <TitleCell
      name={automation.name}
      link={makeAutomationDetailsPathname(
        organization.slug,
        automation.id,
        automationsLinkPrefix
      )}
      disabled={!automation.enabled}
      warning={warning}
      openInNewTab={openInNewTab}
    />
  );
}
