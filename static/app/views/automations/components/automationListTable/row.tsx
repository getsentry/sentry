import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {ProjectList} from 'sentry/components/projectList';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import useOrganization from 'sentry/utils/useOrganization';
import {AutomationListConnectedDetectors} from 'sentry/views/automations/components/automationListTable/conenctedDetectors';
import {
  getAutomationActions,
  useAutomationProjectIds,
} from 'sentry/views/automations/hooks/utils';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';

type AutomationListRowProps = {
  automation: Automation;
};

export function AutomationListRow({automation}: AutomationListRowProps) {
  const organization = useOrganization();
  const actions = getAutomationActions(automation);
  const {id, name, disabled, lastTriggered, detectorIds = [], createdBy} = automation;
  const projectIds = useAutomationProjectIds(automation);
  const projectSlugs = projectIds.map(
    projectId => ProjectsStore.getById(projectId)?.slug
  ) as string[];
  return (
    <AutomationSimpleTableRow
      variant={disabled ? 'faded' : 'default'}
      data-test-id="automation-list-row"
    >
      <SimpleTable.RowCell name="name">
        <AutomationTitleCell
          name={name}
          href={makeAutomationDetailsPathname(organization.slug, id)}
          createdBy={createdBy}
        />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell name="last-triggered">
        <TimeAgoCell date={lastTriggered} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell name="action">
        <ActionCell actions={actions} disabled={disabled} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell name="projects">
        <ProjectList projectSlugs={projectSlugs} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell name="connected-monitors">
        <AutomationListConnectedDetectors detectorIds={detectorIds} />
      </SimpleTable.RowCell>
    </AutomationSimpleTableRow>
  );
}

export function AutomationListRowSkeleton() {
  return (
    <AutomationSimpleTableRow>
      <SimpleTable.RowCell name="name">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell name="last-triggered">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell name="action">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell name="projects">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell name="connected-monitors">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
    </AutomationSimpleTableRow>
  );
}

const AutomationSimpleTableRow = styled(SimpleTable.Row)`
  min-height: 54px;
`;
