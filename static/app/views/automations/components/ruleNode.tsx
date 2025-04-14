import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {dataConditionNodesMap} from 'sentry/views/automations/components/dataConditionNodes';

interface RuleNodeProps {
  condition: Omit<DataCondition, 'condition_group' | 'type' | 'id'>;
  condition_id: string;
  onDelete: () => void;
  onUpdate: (comparison: Record<string, any>) => void;
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
          {(() => {
            const node = dataConditionNodesMap[condition.comparison_type];
            const configNode = node?.configNode;
            if (configNode) {
              return configNode(condition, condition_id, onUpdate);
            }
            return node?.label;
          })()}
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

const RuleRow = styled(Flex)`
  align-items: center;
  padding: ${space(1)};
`;

const Rule = styled(Flex)`
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const DeleteButton = styled(Button)`
  flex-shrink: 0;
  opacity: 0;

  ${RuleRowContainer}:hover & {
    opacity: 1;
  }
`;
