import {Fragment} from 'react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {Automation} from 'sentry/types/workflowEngine/automations';

import {AlertConditionGroup} from 'admin/views/alertsDebug/components/alertConditionGroup';
import {AlertDataAttribute} from 'admin/views/alertsDebug/components/alertDataAttribute';

interface AlertDetailsProps {
  workflow: Automation;
}

export function AlertDetails({workflow}: AlertDetailsProps) {
  return (
    <Fragment>
      <Heading as="h1">{workflow.name}</Heading>

      <Stack gap="lg">
        <Heading as="h2">Settings</Heading>
        <Container background="primary" padding="lg" radius="md" border="primary">
          <Stack gap="sm">
            {Object.entries(workflow).map(([key, value]) => (
              <AlertDataAttribute dataKey={key} key={key} value={value} />
            ))}
          </Stack>
        </Container>
      </Stack>

      <Flex gap="xl">
        <Stack flex="1" gap="xl">
          <Heading as="h3">Workflow Triggers</Heading>
          {workflow.triggers ? (
            <AlertConditionGroup group={workflow.triggers} />
          ) : (
            <Text>None</Text>
          )}
        </Stack>

        {workflow.actionFilters && (
          <Stack flex="1" gap="xl">
            <Heading as="h3">Action Filters</Heading>
            {workflow.actionFilters.length === 0 ? (
              <Text>None</Text>
            ) : (
              workflow.actionFilters.map(actionFilter => (
                <AlertConditionGroup key={actionFilter.id} group={actionFilter} />
              ))
            )}
          </Stack>
        )}
      </Flex>
    </Fragment>
  );
}
