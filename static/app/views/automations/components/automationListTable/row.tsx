import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {ProjectList} from 'sentry/components/projectList';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {AutomationListConnectedDetectors} from 'sentry/views/automations/components/automationListTable/connectedDetectors';
import {
  getAutomationActions,
  useAutomationProjectIds,
} from 'sentry/views/automations/hooks/utils';

type AutomationListRowProps = {
  automation: Automation;
};

export function AutomationListRow({automation}: AutomationListRowProps) {
  const actions = getAutomationActions(automation);
  const {disabled, lastTriggered, detectorIds = []} = automation;
  const projectIds = useAutomationProjectIds(automation);
  const projectSlugs = projectIds.map(
    projectId => ProjectsStore.getById(projectId)?.slug
  ) as string[];

  return (
    <AutomationSimpleTableRow
      variant={disabled ? 'faded' : 'default'}
      data-test-id="automation-list-row"
    >
      <SimpleTable.RowCell className="name">
        <AutomationTitleCell automation={automation} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="last-triggered">
        <TimeAgoCell date={lastTriggered} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="action">
        <ActionCell actions={actions} disabled={disabled} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="projects">
        <ProjectList projectSlugs={projectSlugs} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="connected-monitors">
        <AutomationListConnectedDetectors detectorIds={detectorIds} />
      </SimpleTable.RowCell>
    </AutomationSimpleTableRow>
  );
}

export function AutomationListRowSkeleton() {
  return (
    <AutomationSimpleTableRow>
      <SimpleTable.RowCell className="name">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="last-triggered">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="action">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="projects">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="connected-monitors">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
    </AutomationSimpleTableRow>
  );
}

const AutomationSimpleTableRow = styled(SimpleTable.Row)`
  min-height: 54px;
`;
