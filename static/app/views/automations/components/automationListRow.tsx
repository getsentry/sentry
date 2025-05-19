import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Checkbox} from 'sentry/components/core/checkbox';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {ProjectList} from 'sentry/components/projectList';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {ConnectionCell} from 'sentry/components/workflowEngine/gridCell/connectionCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useAutomationActions,
  useAutomationProjectIds,
} from 'sentry/views/automations/hooks/utils';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';

type AutomationListRowProps = {
  automation: Automation;
  handleSelect: (id: string, checked: boolean) => void;
  selected: boolean;
};

export function AutomationListRow({
  automation,
  handleSelect,
  selected,
}: AutomationListRowProps) {
  const organization = useOrganization();
  const actions = useAutomationActions(automation);
  const {id, name, disabled, lastTriggered, detectorIds = []} = automation;
  const projectIds = useAutomationProjectIds(automation);
  const projectSlugs = projectIds.map(
    projectId => ProjectsStore.getById(projectId)?.slug
  ) as string[];
  return (
    <RowWrapper disabled={disabled}>
      <InteractionStateLayer />
      <Flex justify="space-between">
        <StyledCheckbox
          checked={selected}
          onChange={() => {
            handleSelect(id, !selected);
          }}
        />
        <CellWrapper>
          <AutomationTitleCell
            name={name}
            href={makeAutomationDetailsPathname(organization.slug, id)}
          />
        </CellWrapper>
      </Flex>
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
        <ConnectionCell ids={detectorIds} type="detector" disabled={disabled} />
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
  position: relative;
  align-items: center;
  padding: ${space(2)};

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

  .last-triggered,
  .action,
  .connected-monitors {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 2.5fr 1fr;

    .action {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 2.5fr 1fr 1fr;

    .last-triggered {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 2.5fr 1fr 1fr 1fr;

    .connected-monitors {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(0, 3fr) 1fr 1fr 1fr;
  }
`;
