import styled from '@emotion/styled';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {ProjectList} from 'sentry/components/projectList';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import useOrganization from 'sentry/utils/useOrganization';
import {AutomationListConnectedDetectors} from 'sentry/views/automations/components/automationListTable/connectedDetectors';
import {
  getAutomationActions,
  useAutomationProjectIds,
} from 'sentry/views/automations/hooks/utils';

type AutomationListRowProps = {
  automation: Automation;
  onSelect: (id: string) => void;
  selected: boolean;
};

export function AutomationListRow({
  automation,
  selected,
  onSelect,
}: AutomationListRowProps) {
  const organization = useOrganization();
  const canEditAutomations = hasEveryAccess(['alerts:write'], {organization});

  const actions = getAutomationActions(automation);
  const {enabled, lastTriggered, detectorIds = []} = automation;
  const projectIds = useAutomationProjectIds(automation);
  const projectSlugs = projectIds.map(
    projectId => ProjectsStore.getById(projectId)?.slug
  ) as string[];

  return (
    <AutomationSimpleTableRow
      variant={enabled ? 'default' : 'faded'}
      data-test-id="automation-list-row"
    >
      <SimpleTable.RowCell>
        <Flex gap="md" align="center">
          {canEditAutomations && (
            <Flex align="center" flexShrink="0" width="20px" height="20px">
              <Checkbox
                checked={selected}
                onChange={() => onSelect(automation.id)}
                className="select-row"
              />
            </Flex>
          )}
          <AutomationTitleCell automation={automation} />
        </Flex>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="last-triggered">
        <TimeAgoCell date={lastTriggered} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="action">
        <ActionCell actions={actions} disabled={!enabled} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="projects">
        <ProjectList projectSlugs={projectSlugs} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="connected-monitors">
        <AutomationListConnectedDetectors detectorIds={detectorIds} />
      </SimpleTable.RowCell>
    </AutomationSimpleTableRow>
  );
}

export function AutomationListRowSkeleton() {
  return (
    <AutomationSimpleTableRow>
      <SimpleTable.RowCell>
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="last-triggered">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="action">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="projects">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="connected-monitors">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
    </AutomationSimpleTableRow>
  );
}

const AutomationSimpleTableRow = styled(SimpleTable.Row)`
  min-height: 54px;

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  @media (hover: hover) {
    &:not(:has(:hover)):not(:has(input:checked)) {
      .select-row {
        ${p => p.theme.visuallyHidden}
      }
    }
  }
`;
