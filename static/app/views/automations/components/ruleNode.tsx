import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NewDataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionNodeContext,
  dataConditionNodesMap,
  useDataConditionNodeContext,
} from 'sentry/views/automations/components/dataConditionNodes';

interface RuleNodeProps {
  condition: NewDataCondition;
  condition_id: string;
  onDelete: () => void;
  onUpdate: (comparison: Record<string, any>) => void;
}

function Node() {
  const {condition} = useDataConditionNodeContext();
  const node = dataConditionNodesMap.get(condition.comparison_type);

  const Component = node?.dataCondition;
  return Component ? Component : node?.label;
}

export default function RuleNode({
  condition,
  condition_id,
  onDelete,
  onUpdate,
}: RuleNodeProps) {
  return (
    <RuleRowContainer>
      <RuleRow>
        <Rule>
          <DataConditionNodeContext.Provider value={{condition, condition_id, onUpdate}}>
            <Node />
          </DataConditionNodeContext.Provider>
        </Rule>
        <DeleteButton
          aria-label={t('Delete Node')}
          size="sm"
          icon={<IconDelete />}
          borderless
          onClick={onDelete}
        />
      </RuleRow>
    </RuleRowContainer>
  );
}

const RuleRowContainer = styled('div')<{incompatible?: boolean}>`
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => p.theme.innerBorder} solid;
  border-color: ${p => (p.incompatible ? p.theme.red200 : 'none')};
`;

const RuleRow = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
`;

const Rule = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const DeleteButton = styled(Button)`
  flex-shrink: 0;
  opacity: 0;

  ${RuleRowContainer}:hover &,
  ${RuleRowContainer}:focus-within &,
  &:focus {
    opacity: 1;
  }
`;
