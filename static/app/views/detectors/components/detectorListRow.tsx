import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';
import {Flex} from 'sentry/components/container/flex';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {
  ConnectionCell,
  type Item,
} from 'sentry/components/workflowEngine/gridCell/connectionCell';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {NumberCell} from 'sentry/components/workflowEngine/gridCell/numberCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {AvatarProject} from 'sentry/types/project';

export type Detector = {
  automations: Item[];
  groups: Group[];
  id: string;
  link: string;
  name: string;
  project: AvatarProject;
  details?: string[];
  disabled?: boolean;
};

type DetectorListRowProps = Detector & {
  handleSelect: (id: string, checked: boolean) => void;
  selected: boolean;
};

export function DetectorListRow({
  automations,
  groups,
  id,
  link,
  name,
  project,
  details,
  handleSelect,
  selected,
  disabled,
}: DetectorListRowProps) {
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
            details={details}
            disabled={disabled}
          />
        </CellWrapper>
        <StyledGraphCell />
      </Flex>
      <CellWrapper className="last-issue">
        <StyledIssueCell
          group={groups.length > 0 ? groups[0] : undefined}
          disabled={disabled}
        />
      </CellWrapper>
      <CellWrapper className="open-issues">
        <NumberCell number={groups.length} />
      </CellWrapper>
      <CellWrapper className="connected-automations">
        <ConnectionCell
          items={automations}
          renderText={count => tn('%s automation', '%s automations', count)}
          disabled={disabled}
        />
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
