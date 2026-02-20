import {Fragment, useState, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Heading, Text} from '@sentry/scraps/text';

import {KeyValueData} from 'sentry/components/keyValueData';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {TimeRangeSelector, type ChangeData} from 'sentry/components/timeRangeSelector';

import {useLogDetails} from 'admin/views/alertsDebug/hooks/useLogDetails';
import {useWorkflowLogs} from 'admin/views/alertsDebug/hooks/useWorkflowLogs';

interface WorkflowLogsProps {
  organizationId: string | undefined;
  workflowId: number | undefined;
}

type ViewMode = 'list' | 'byType';

// Fields to exclude from detail display (shown in header already)
const HEADER_FIELDS = ['id', 'timestamp', 'message', 'severity'];

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

interface LogEntryDetailsProps {
  logId: string;
  organizationId: string | undefined;
  timestamp: string;
}

function LogEntryDetails({logId, timestamp, organizationId}: LogEntryDetailsProps) {
  const {data, isPending, isError} = useLogDetails(logId, timestamp, organizationId);

  if (isPending) {
    return (
      <Flex gap="sm" align="center" padding="sm">
        <LoadingIndicator mini />
        <Text size="sm" variant="muted">
          Loading details...
        </Text>
      </Flex>
    );
  }

  if (isError || !data?.data?.[0]) {
    return (
      <Text size="sm" variant="danger">
        Failed to load log details
      </Text>
    );
  }

  const logDetails = data.data[0];
  const contentItems = Object.entries(logDetails)
    .filter(
      ([key, value]) =>
        !HEADER_FIELDS.includes(key) && value !== null && value !== undefined
    )
    .map(([key, value]) => ({
      item: {key, subject: key, value: value as ReactNode},
    }));

  if (contentItems.length === 0) {
    return (
      <Text size="sm" variant="muted">
        No additional details available
      </Text>
    );
  }

  return (
    <StyledKeyValueCard>
      <KeyValueData.Card contentItems={contentItems} sortAlphabetically />
    </StyledKeyValueCard>
  );
}

/**
 * Displays workflow-related logs from the Logging product.
 * Shows the latest logs with expandable details for each entry.
 * Details are fetched on-demand when expanding a log entry.
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
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

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

  // Handle time range changes - reset cursor and expanded state
  const handleTimeRangeChange = (newTimeRange: ChangeData) => {
    setTimeRange(newTimeRange);
    setCursor(undefined);
    setExpandedLogIds(new Set());
  };

  // Handle view mode changes - reset cursor and expanded state
  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
    setCursor(undefined);
    setExpandedLogIds(new Set());
  };

  // Handle clicking a grouped log - switch to list view with filter
  const handleGroupedLogClick = (message: string) => {
    setMessageFilter(message);
    setViewMode('list');
    setCursor(undefined);
    setExpandedLogIds(new Set());
  };

  // Clear message filter
  const handleShowAll = () => {
    setMessageFilter(null);
    setCursor(undefined);
    setExpandedLogIds(new Set());
  };

  // Handle disclosure expand/collapse - track which logs are expanded
  const handleExpandedChange = (logId: string, isExpanded: boolean) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (isExpanded) {
        next.add(logId);
      } else {
        next.delete(logId);
      }
      return next;
    });
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
                    background="primary"
                    radius="md"
                    border="primary"
                  >
                    <Disclosure
                      size="sm"
                      onExpandedChange={isExpanded =>
                        handleExpandedChange(log.id, isExpanded)
                      }
                    >
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
                        {expandedLogIds.has(log.id) && (
                          <LogEntryDetails
                            logId={log.id}
                            timestamp={log.timestamp}
                            organizationId={organizationId}
                          />
                        )}
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

const StyledKeyValueCard = styled('div')`
  & > div {
    padding: 0;
    border: none;
    border-top: 1px solid ${p => p.theme.border};
    border-radius: 0;
    background: ${p => p.theme.background};
  }
`;
