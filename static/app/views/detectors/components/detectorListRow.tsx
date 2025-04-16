import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Checkbox} from 'sentry/components/core/checkbox';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {ConnectionCell} from 'sentry/components/workflowEngine/gridCell/connectionCell';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {TypeCell} from 'sentry/components/workflowEngine/gridCell/typeCell';
import {UserCell} from 'sentry/components/workflowEngine/gridCell/userCell';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {AvatarProject} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';

interface DetectorListRowProps {
  detector: Detector;
  handleSelect: (id: string, checked: boolean) => void;
  selected: boolean;
}

export function DetectorListRow({
  detector: {workflowIds, id, name, disabled},
  handleSelect,
  selected,
}: DetectorListRowProps) {
  const link = `/issues/monitors/${id}/`;
  const project: AvatarProject = {
    slug: name,
    platform: 'javascript-astro',
  };
  const issues: Group[] = [];
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
          <StyledTitleCell
            name={name}
            project={project}
            link={link}
            disabled={disabled}
          />
        </CellWrapper>
        <StyledGraphCell />
      </Flex>
      <CellWrapper className="type">
        <TypeCell type="errors" />
      </CellWrapper>
      <CellWrapper className="last-issue">
        <StyledIssueCell
          group={issues.length > 0 ? issues[0] : undefined}
          disabled={disabled}
        />
      </CellWrapper>
      <CellWrapper className="creator">
        <UserCell user="sentry" />
      </CellWrapper>
      <CellWrapper className="connected-automations">
        <ConnectionCell ids={workflowIds} type="workflow" disabled={disabled} />
      </CellWrapper>
    </RowWrapper>
  );
}

const StyledCheckbox = styled(Checkbox)<{checked?: boolean}>`
  visibility: ${p => (p.checked ? 'visible' : 'hidden')};
  align-self: flex-start;
  opacity: 1;
`;

const StyledGraphCell = styled(EmptyCell)`
  width: 35%;
`;

const CellWrapper = styled(Flex)`
  padding: 0 ${space(2)};
  flex: 1;
`;

const StyledTitleCell = styled(TitleCell)`
  padding: ${space(2)};
  margin: -${space(2)};
`;

const StyledIssueCell = styled(IssueCell)`
  padding: ${space(2)};
  margin: -${space(2)};
`;

const RowWrapper = styled('div')<{disabled?: boolean}>`
  display: grid;
  position: relative;
  align-items: center;
  padding: ${space(2)};

  ${p =>
    p.disabled &&
    `
      ${CellWrapper}, ${StyledGraphCell} {
        opacity: 0.6;
      }
    `}

  &:hover {
    ${StyledCheckbox} {
      visibility: visible;
    }
  }

  .open-issues,
  .last-issue,
  .connected-automations {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 3fr 1fr;

    .open-issues {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 3fr 1fr 0.6fr;

    .last-issue {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 2.5fr 1fr 0.75fr 1fr;

    .connected-automations {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: 3fr 1fr 0.75fr 1fr;
  }
`;
