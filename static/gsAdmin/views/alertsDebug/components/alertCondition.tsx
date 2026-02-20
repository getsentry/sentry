import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {KeyValueData} from 'sentry/components/keyValueData';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';

interface AlertConditionProps {
  condition: DataCondition;
}

export function AlertCondition({condition}: AlertConditionProps) {
  const contentItems = [
    {
      item: {
        key: 'type',
        subject: 'type',
        value: condition.type as ReactNode,
      },
    },
    {
      item: {
        key: 'comparison',
        subject: 'comparison',
        value: condition.comparison as ReactNode,
      },
    },
    condition.conditionResult !== undefined && {
      item: {
        key: 'conditionResult',
        subject: 'conditionResult',
        value: condition.conditionResult as ReactNode,
      },
    },
  ].filter(Boolean) as Array<{item: {key: string; subject: string; value: ReactNode}}>;

  return (
    <StyledCard>
      <KeyValueData.Card contentItems={contentItems} />
    </StyledCard>
  );
}

const StyledCard = styled('div')`
  > div {
    margin-bottom: 0;
  }
`;
