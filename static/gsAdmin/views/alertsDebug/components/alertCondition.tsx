import {Tag} from '@sentry/scraps/badge';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';

import {AlertDataAttribute} from 'admin/views/alertsDebug/components/alertDataAttribute';

interface AlertConditionProps {
  condition: DataCondition;
  background?: 'primary' | 'secondary' | 'tertiary';
}

export function AlertCondition({condition, background = 'primary'}: AlertConditionProps) {
  return (
    <Container padding="md" background={background} radius="md" border="primary">
      <Stack gap="xs">
        <AlertDataAttribute dataKey="id" value={condition.id} />
        <AlertDataAttribute dataKey="comparison" value={condition.comparison} />
        <AlertDataAttribute dataKey="conditionResult" value={condition.conditionResult} />

        <Stack direction="row" gap="xs" align="center">
          <Text bold>type:</Text>
          <Tag variant="info">{condition.type}</Tag>
        </Stack>
      </Stack>
    </Container>
  );
}
