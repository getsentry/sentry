import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {NotificationTemplateRegistration} from 'sentry/debug/notifications/types';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

const enum ExampleDataFormat {
  FORMATTED = 'formatted',
  RAW = 'raw',
}

export function DebugNotificationsExample({
  registration,
}: {
  registration: NotificationTemplateRegistration;
}) {
  const [displayFormat, setDisplayFormat] = useLocalStorageState(
    'debug-notifications-example-displayed-raw',
    ExampleDataFormat.FORMATTED
  );
  return (
    <Container padding="md" border="primary" radius="md">
      <Grid columns="1fr auto" gap="lg xl">
        <Flex justify="between" column="span 2" align="center">
          <Heading as="h3">Example Data</Heading>
          <SegmentedControl
            value={displayFormat}
            onChange={setDisplayFormat}
            size="xs"
            aria-label="Change example data format"
          >
            <SegmentedControl.Item key={ExampleDataFormat.FORMATTED}>
              Formatted
            </SegmentedControl.Item>
            <SegmentedControl.Item key={ExampleDataFormat.RAW}>Raw</SegmentedControl.Item>
          </SegmentedControl>
        </Flex>
        <Text variant="success" bold>
          Subject
        </Text>
        <Text>{registration.example.subject}</Text>
        <Text variant="success" bold>
          Body
        </Text>
        <Text>{registration.example.body}</Text>
        <Text variant="success" bold>
          Actions
        </Text>
        <Flex gap="md" align="center" justify="start">
          {registration.example.actions.map((action, index) => (
            <Button key={index} onClick={() => {}} title={action.link} size="sm">
              {action.label}
            </Button>
          ))}
        </Flex>
        {registration.example.chart && (
          <Fragment>
            <Text variant="success" bold>
              Chart
            </Text>
            <Tooltip
              title={
                <Grid columns="1fr auto" gap="sm" align="start" justify="start">
                  <Text bold>src</Text>
                  <Text align="left">{registration.example.chart?.url}</Text>
                  <Text bold>alt</Text>
                  <Text align="left">{registration.example.chart?.alt_text}</Text>
                </Grid>
              }
              skipWrapper
            >
              <PlaceholderChart />
            </Tooltip>
          </Fragment>
        )}
        {registration.example.footer && (
          <Fragment>
            <Text variant="success" bold>
              Footer
            </Text>
            <Text>{registration.example.footer}</Text>
          </Fragment>
        )}
      </Grid>
    </Container>
  );
}

const PlaceholderChart = styled('div')`
  height: 100px;
  width: 200px;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: linear-gradient(
    to bottom right,
    ${p => p.theme.tokens.background.primary},
    ${p => p.theme.tokens.background.secondary},
    ${p => p.theme.tokens.background.tertiary}
  );
`;
