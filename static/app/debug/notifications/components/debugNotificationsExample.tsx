import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {CodeBlock} from 'sentry/components/core/code';
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
    'debug-notifications-example-display-format',
    ExampleDataFormat.FORMATTED
  );
  return (
    <Container padding="md" border="primary" radius="md">
      <ExampleGrid columns="1fr auto" gap="lg xl">
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
        {displayFormat === ExampleDataFormat.FORMATTED ? (
          <Text>{registration.example.subject}</Text>
        ) : (
          <CodeBlock language="javascript">
            {JSON.stringify(registration.example.subject)}
          </CodeBlock>
        )}
        <Text variant="success" bold>
          Body
        </Text>
        {displayFormat === ExampleDataFormat.FORMATTED ? (
          <Text>{JSON.stringify(registration.example.body)}</Text>
        ) : (
          <CodeBlock language="javascript">
            {JSON.stringify(registration.example.body)}
          </CodeBlock>
        )}
        {registration.example.actions.length > 0 && (
          <Fragment>
            <Text variant="success" bold>
              Actions
            </Text>
            {displayFormat === ExampleDataFormat.FORMATTED ? (
              <div style={{display: 'inline'}}>
                {registration.example.actions.map((action, index) => (
                  <InlineButton
                    key={index}
                    onClick={() => {}}
                    title={action.link}
                    size="sm"
                  >
                    {action.label}
                  </InlineButton>
                ))}
              </div>
            ) : (
              <CodeBlock language="json">
                {JSON.stringify(registration.example.actions, null, 2)}
              </CodeBlock>
            )}
          </Fragment>
        )}
        {registration.example.chart && (
          <Fragment>
            <Text variant="success" bold>
              Chart
            </Text>
            {displayFormat === ExampleDataFormat.FORMATTED ? (
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
            ) : (
              <CodeBlock language="json">
                {JSON.stringify(registration.example.chart, null, 2)}
              </CodeBlock>
            )}
          </Fragment>
        )}
        {registration.example.footer && (
          <Fragment>
            <Text variant="success" bold>
              Footer
            </Text>
            {displayFormat === ExampleDataFormat.FORMATTED ? (
              <Text>{registration.example.footer}</Text>
            ) : (
              <CodeBlock language="javascript">
                {JSON.stringify(registration.example.footer)}
              </CodeBlock>
            )}
          </Fragment>
        )}
      </ExampleGrid>
    </Container>
  );
}

const PlaceholderChart = styled('div')`
  height: 100px;
  width: 200px;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  background: linear-gradient(
    to bottom right,
    ${p => p.theme.tokens.background.primary},
    ${p => p.theme.tokens.background.secondary},
    ${p => p.theme.tokens.background.tertiary}
  );
`;

const InlineButton = styled(Button)`
  display: inline-block;
  margin: ${p => `0 ${p.theme.space.xs} 0 0`};
`;

const ExampleGrid = styled(Grid)`
  pre,
  code {
    white-space: pre-wrap;
  }
`;
