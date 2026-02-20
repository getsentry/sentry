import {Fragment, useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Heading, Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {TimeRangeSelector, type ChangeData} from 'sentry/components/timeRangeSelector';

import {useWorkflowLogs} from 'admin/views/alertsDebug/hooks/useWorkflowLogs';

interface WorkflowLogsProps {
  organizationId: string | undefined;
  workflowId: number | undefined;
}

type ViewMode = 'list' | 'byType';

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

function formatLogValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return '';
}

/**
 * Displays workflow-related logs from the Logging product.
 * Shows the latest 25 logs with expandable details for each entry.
 * Supports time range filtering and grouping by message.
 */
export function WorkflowLogs({workflowId, organizationId}: WorkflowLogsProps) {
  const [timeRange, setTimeRange] = useState<ChangeData>({
    relative: '24h',
    start: undefined,
    end: undefined,
    utc: false,
  });
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [messageFilter, setMessageFilter] = useState<string | null>(null);

  const {data, isPending, isError, getResponseHeader} = useWorkflowLogs(
    workflowId,
    organizationId,
    {
      statsPeriod: timeRange.relative ?? undefined,
      start: timeRange.start?.toISOString(),
      end: timeRange.end?.toISOString(),
      groupByMessage: viewMode === 'byType',
      cursor,
      messageFilter: messageFilter ?? undefined,
    }
  );

  const logs = data?.data ?? [];
  const pageLinks = getResponseHeader?.('Link') ?? null;

  // Handle time range changes - reset cursor
  const handleTimeRangeChange = (newTimeRange: ChangeData) => {
    setTimeRange(newTimeRange);
    setCursor(undefined);
  };

  // Handle view mode changes - reset cursor
  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
    setCursor(undefined);
  };

  // Handle clicking a grouped log - switch to list view with filter
  const handleGroupedLogClick = (message: string) => {
    setMessageFilter(message);
    setViewMode('list');
    setCursor(undefined);
  };

  // Clear message filter
  const handleShowAll = () => {
    setMessageFilter(null);
    setCursor(undefined);
  };

  return (
    <Disclosure defaultExpanded>
      <Disclosure.Title>
        <Heading as="h3">Workflow Logs</Heading>
      </Disclosure.Title>
      <Disclosure.Content>
        <Stack gap="md">
          <Flex gap="md" align="center">
            <TimeRangeSelector
              relative={timeRange.relative}
              start={timeRange.start}
              end={timeRange.end}
              utc={timeRange.utc}
              onChange={handleTimeRangeChange}
              showAbsolute
              showRelative
            />
            <SegmentedControl
              value={viewMode}
              onChange={handleViewModeChange}
              size="sm"
              aria-label="View mode"
            >
              <SegmentedControl.Item key="list">List</SegmentedControl.Item>
              <SegmentedControl.Item key="byType">By Type</SegmentedControl.Item>
            </SegmentedControl>
          </Flex>

          {messageFilter && (
            <Flex gap="sm" align="center">
              <Text size="sm" variant="muted">
                Filtering by:{' '}
                <Text as="span" size="sm" bold>
                  {messageFilter}
                </Text>
              </Text>
              <Button size="xs" onClick={handleShowAll}>
                Show all
              </Button>
            </Flex>
          )}

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
              No logs found for this workflow in the selected time range.
            </Text>
          )}

          {!isPending && !isError && viewMode === 'byType' && logs.length > 0 && (
            <Stack gap="sm">
              {logs.map(log => (
                <Container
                  key={log.message}
                  padding="sm"
                  background="secondary"
                  radius="md"
                  border="primary"
                  onClick={() => handleGroupedLogClick(log.message)}
                  style={{cursor: 'pointer'}}
                >
                  <Flex gap="md" align="center" justify="between">
                    <Text
                      size="sm"
                      style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis'}}
                    >
                      {log.message}
                    </Text>
                    <Tag variant="info">
                      {(log as {'count(message)': number})['count(message)']} occurrences
                    </Tag>
                  </Flex>
                </Container>
              ))}
            </Stack>
          )}

          {!isPending && !isError && viewMode === 'list' && logs.length > 0 && (
            <Fragment>
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
                                !['id', 'timestamp', 'message', 'severity'].includes(
                                  key
                                ) &&
                                value !== null &&
                                value !== undefined
                            )
                            .map(([key, value]) => (
                              <Flex key={key} gap="sm">
                                <Text size="sm" bold style={{minWidth: 120}}>
                                  {key}:
                                </Text>
                                <Text size="sm" variant="muted">
                                  {formatLogValue(value)}
                                </Text>
                              </Flex>
                            ))}
                        </Stack>
                      </Disclosure.Content>
                    </Disclosure>
                  </Container>
                ))}
              </Stack>
              <Pagination pageLinks={pageLinks} onCursor={setCursor} />
            </Fragment>
          )}
        </Stack>
      </Disclosure.Content>
    </Disclosure>
  );
}
