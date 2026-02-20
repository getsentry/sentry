import {Tag} from '@sentry/scraps/badge';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';

import {useWorkflowLogs} from 'admin/views/alertsDebug/hooks/useWorkflowLogs';

interface WorkflowLogsProps {
  organizationId: string | undefined;
  workflowId: number | undefined;
}

function getSeverityVariant(
  severity: string
): 'danger' | 'warning' | 'info' | 'success' | 'muted' {
  const severityLower = severity?.toLowerCase();
  switch (severityLower) {
    case 'error':
    case 'fatal':
    case 'critical':
      return 'danger';
    case 'warning':
    case 'warn':
      return 'warning';
    case 'info':
      return 'info';
    case 'debug':
    case 'trace':
      return 'muted';
    default:
      return 'info';
  }
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Displays workflow-related logs from the Logging product.
 * Shows the latest 25 logs with expandable details for each entry.
 */
export function WorkflowLogs({workflowId, organizationId}: WorkflowLogsProps) {
  const {data, isPending, isError} = useWorkflowLogs(workflowId, organizationId);

  const logs = data?.data ?? [];

  return (
    <Disclosure defaultExpanded>
      <Disclosure.Title>
        <Heading as="h3">Workflow Logs</Heading>
      </Disclosure.Title>
      <Disclosure.Content>
        <Stack gap="md">
          {isPending && (
            <Flex gap="md" align="center">
              <LoadingIndicator mini />
              <Text>Loading logs...</Text>
            </Flex>
          )}

          {isError && (
            <Text variant="danger">Error loading logs. Check the browser console.</Text>
          )}

          {!isPending && !isError && logs.length === 0 && (
            <Text variant="muted">
              No logs found for this workflow in the last 24 hours.
            </Text>
          )}

          {!isPending && !isError && logs.length > 0 && (
            <Stack gap="sm">
              {logs.map(log => (
                <Container
                  key={log.id}
                  padding="sm"
                  background="secondary"
                  radius="md"
                  border="primary"
                >
                  <Disclosure size="sm">
                    <Disclosure.Title>
                      <Flex gap="md" align="center" flex="1">
                        <Text size="sm" variant="muted">
                          {formatTimestamp(log.timestamp)}
                        </Text>
                        <Tag variant={getSeverityVariant(log.severity)}>
                          {log.severity}
                        </Tag>
                        <Text
                          size="sm"
                          style={{overflow: 'hidden', textOverflow: 'ellipsis'}}
                        >
                          {log.message}
                        </Text>
                      </Flex>
                    </Disclosure.Title>
                    <Disclosure.Content>
                      <Stack gap="xs">
                        {Object.entries(log)
                          .filter(
                            ([key, value]) =>
                              !['id', 'timestamp', 'message', 'severity'].includes(key) &&
                              value !== null &&
                              value !== undefined
                          )
                          .map(([key, value]) => (
                            <Flex key={key} gap="sm">
                              <Text size="sm" bold style={{minWidth: 120}}>
                                {key}:
                              </Text>
                              <Text size="sm" variant="muted">
                                {typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value)}
                              </Text>
                            </Flex>
                          ))}
                      </Stack>
                    </Disclosure.Content>
                  </Disclosure>
                </Container>
              ))}
            </Stack>
          )}
        </Stack>
      </Disclosure.Content>
    </Disclosure>
  );
}
