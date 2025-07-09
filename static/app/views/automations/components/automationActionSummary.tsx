import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCircledNumber} from 'sentry/components/iconCircledNumber';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ActionType} from 'sentry/types/workflowEngine/actions';

type AutomationActionSummaryProps = {
  actions: ActionType[];
  className?: string;
  hasTooltip?: boolean;
};

export function AutomationActionSummary({
  className,
  actions,
  hasTooltip,
}: AutomationActionSummaryProps) {
  if (actions.length === 0) {
    return t('No actions');
  }

  if (actions.length === 1 && actions[0]) {
    const action = actions[0];
    const metadata = ActionMetadata[action];
    if (!metadata) {
      return t('1 action');
    }
    const {name, icon} = metadata;
    return (
      <Flex align="center" gap={space(0.75)} className={className}>
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
    <ActionContainer align="center" gap={space(0.75)} className={className}>
      <IconContainer>
        <IconCircledNumber number={actions.length} />
      </IconContainer>
      <Tooltip title={actionsList} disabled={!hasTooltip} showUnderline={hasTooltip}>
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
