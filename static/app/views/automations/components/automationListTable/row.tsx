import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Checkbox} from 'sentry/components/core/checkbox';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import Placeholder from 'sentry/components/placeholder';
import {ProjectList} from 'sentry/components/projectList';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
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
    <RowWrapper disabled={disabled} data-test-id="automation-list-row">
      <InteractionStateLayer />
      <CellWrapper>
        <AutomationTitleCell
          name={name}
          href={makeAutomationDetailsPathname(organization.slug, id)}
          createdBy={createdBy}
        />
      </CellWrapper>
      <CellWrapper className="last-triggered">
        <TimeAgoCell date={lastTriggered} />
      </CellWrapper>
      <CellWrapper className="action">
        <ActionCell actions={actions} disabled={disabled} />
      </CellWrapper>
      <CellWrapper className="projects">
        <ProjectList projectSlugs={projectSlugs} />
      </CellWrapper>
      <CellWrapper className="connected-monitors">
        <AutomationListConnectedDetectors detectorIds={detectorIds} />
      </CellWrapper>
    </RowWrapper>
  );
}

export function AutomationListRowSkeleton() {
  return (
    <RowWrapper>
      <CellWrapper>
        <Placeholder height="20px" />
      </CellWrapper>
      <CellWrapper className="last-triggered">
        <Placeholder height="20px" />
      </CellWrapper>
      <CellWrapper className="action">
        <Placeholder height="20px" />
      </CellWrapper>
      <CellWrapper className="projects">
        <Placeholder height="20px" />
      </CellWrapper>
      <CellWrapper className="connected-monitors">
        <Placeholder height="20px" />
      </CellWrapper>
    </RowWrapper>
  );
}

const StyledCheckbox = styled(Checkbox)<{checked?: boolean}>`
  visibility: ${p => (p.checked ? 'visible' : 'hidden')};
  align-self: flex-start;
  opacity: 1;
`;

const CellWrapper = styled('div')`
  justify-content: start;
  padding: 0 ${space(2)};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 100%;
  min-width: 0;
`;

const RowWrapper = styled('div')<{disabled?: boolean}>`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1/-1;

  position: relative;
  align-items: center;
  padding: ${space(2)};

  min-height: 60px;

  ${p =>
    p.disabled &&
    css`
      ${CellWrapper} {
        opacity: 0.6;
      }
    `}

  &:hover {
    ${StyledCheckbox} {
      visibility: visible;
    }
  }
`;
