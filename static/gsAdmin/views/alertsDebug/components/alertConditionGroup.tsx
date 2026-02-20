import {Fragment} from 'react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';

import {AlertCondition} from 'admin/views/alertsDebug/components/alertCondition';

interface AlertConditionGroupProps {
  group: DataConditionGroup;
}

export function AlertConditionGroup({group}: AlertConditionGroupProps) {
  return (
    <Container radius="md" padding="xl" background="primary" border="primary">
      <Stack gap="lg">
        <Stack gap="sm">
          <Heading as="h4">Condition Group: {group.id}</Heading>
          <Flex align="center" gap="xs">
            <Text bold>Logic Type:</Text>
            <Text monospace>{group.logicType}</Text>
          </Flex>
        </Stack>

        {group.conditions && group.conditions.length > 0 && (
          <Stack gap="sm">
            <Heading as="h5">Conditions</Heading>
            <Stack gap="lg">
              {group.conditions.map(condition => (
                <AlertCondition key={condition.id} condition={condition} />
              ))}
            </Stack>
          </Stack>
        )}

        {group.actions && group.actions.length > 0 && (
          <Stack gap="sm">
            <Text bold>Actions</Text>

            <Stack gap="xs">
              {group.actions.map(action => (
                <Fragment key={action.id}>
                  <Text as="div">{action.id}</Text>
                </Fragment>
              ))}
            </Stack>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
