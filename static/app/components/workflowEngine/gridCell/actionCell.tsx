import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCircledNumber} from 'sentry/components/iconCircledNumber';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {space} from 'sentry/styles/space';
import type {ActionType} from 'sentry/types/workflowEngine/actions';

type ActionCellProps = {
  actions: ActionType[];
  disabled?: boolean;
};

export function ActionCell({actions, disabled}: ActionCellProps) {
  if (!actions || actions.length === 0) {
    return <EmptyCell />;
  }

  if (actions.length === 1 && actions[0]) {
    const {name, icon} = ActionMetadata[actions[0]]!;
    return (
      <Flex align="center" gap={space(0.75)}>
        <IconContainer>{icon}</IconContainer>
        {name}
      </Flex>
    );
  }

  const actionsList = actions
    .map(action => ActionMetadata[action]?.name)
    .filter(x => x)
    .join(', ');

  return (
    <ActionContainer align="center" gap={space(0.75)}>
      <IconContainer>
        <IconCircledNumber number={actions.length} />
      </IconContainer>
      <Tooltip title={actionsList} disabled={disabled}>
        <ActionsList>{actionsList}</ActionsList>
      </Tooltip>
    </ActionContainer>
  );
}

const ActionContainer = styled(Flex)`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const ActionsList = styled('span')`
  ${p => p.theme.tooltipUnderline()};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: flex;
`;

const IconContainer = styled('div')`
  display: flex;
  justify-content: center;
  width: 20px;
  line-height: 0;
`;
