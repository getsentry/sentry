import type {ReactNode} from 'react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {KeyValueData} from 'sentry/components/keyValueData';
import type {Automation} from 'sentry/types/workflowEngine/automations';

import {AlertConditionGroup} from 'admin/views/alertsDebug/components/alertConditionGroup';

// Fields to exclude from settings display (shown in dedicated sections)
const EXCLUDED_FIELDS = ['triggers', 'actionFilters'];

interface AlertDetailsProps {
  workflow: Automation;
}

export function AlertDetails({workflow}: AlertDetailsProps) {
  return (
    <Disclosure defaultExpanded>
      <Disclosure.Title>
        <Heading as="h2">Settings</Heading>
      </Disclosure.Title>
      <Disclosure.Content>
        <Stack gap="lg">
          <KeyValueData.Card
            contentItems={Object.entries(workflow)
              .filter(
                ([key, value]) =>
                  !EXCLUDED_FIELDS.includes(key) && value !== null && value !== undefined
              )
              .map(([key, value]) => ({
                item: {key, subject: key, value: value as ReactNode},
              }))}
            sortAlphabetically
          />

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
        </Stack>
      </Disclosure.Content>
    </Disclosure>
  );
}
