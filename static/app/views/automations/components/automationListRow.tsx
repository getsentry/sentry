import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';
import {Flex} from 'sentry/components/container/flex';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {
  type Action,
  ActionCell,
} from 'sentry/components/workflowEngine/gridCell/actionCell';
import {
  ConnectionCell,
  type Item,
} from 'sentry/components/workflowEngine/gridCell/connectionCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {AvatarProject} from 'sentry/types/project';

export type Automation = {
  actions: Action[];
  id: string;
  lastTriggered: Date;
  link: string;
  monitors: Item[];
  name: string;
  project: AvatarProject;
  details?: string[];
  disabled?: boolean;
};

type DetectorListRowProps = Automation & {
  handleSelect: (id: string, checked: boolean) => void;
  selected: boolean;
};

export function AutomationListRow({
  actions,
  id,
  lastTriggered,
  link,
  monitors,
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
      </Flex>
      <CellWrapper className="last-triggered">
        <TimeAgoCell date={lastTriggered} />
      </CellWrapper>
      <CellWrapper className="action">
        <ActionCell actions={actions} disabled={disabled} />
      </CellWrapper>
      <CellWrapper className="connected-monitors">
        <ConnectionCell
          items={monitors}
          renderText={count => tn('%s monitor', '%s monitors', count)}
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

const CellWrapper = styled(Flex)`
  padding: 0 ${space(2)};
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
`;

const StyledTitleCell = styled(TitleCell)`
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
    grid-template-columns: 3fr 1fr 1fr 1fr;
  }
`;
