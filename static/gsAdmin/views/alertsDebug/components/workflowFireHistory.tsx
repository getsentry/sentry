import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {KeyValueData} from 'sentry/components/keyValueData';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {TimeRangeSelector, type ChangeData} from 'sentry/components/timeRangeSelector';

import {
  useWorkflowFireHistory,
  type WorkflowFireHistoryEntry,
} from 'admin/views/alertsDebug/hooks/useWorkflowFireHistory';

interface WorkflowFireHistoryProps {
  organizationIdOrSlug: string | undefined;
  workflowId: number | undefined;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

function buildContentItems(entry: WorkflowFireHistoryEntry) {
  const items: Array<{item: {key: string; subject: string; value: React.ReactNode}}> = [
    {
      item: {
        key: 'issue',
        subject: 'Issue',
        value: entry.group.title,
      },
    },
    {
      item: {
        key: 'eventId',
        subject: 'Event Id',
        value: entry.eventId,
      },
    },
    {
      item: {
        key: 'occurrenceCount',
        subject: 'Occurrences',
        value: entry.count,
      },
    },
  ];

  if (entry.notificationUuid) {
    // This is not being returned by the external facing API, but will be in the admin API
    items.push({
      item: {
        key: 'notificationUuid',
        subject: 'Notification UUID',
        value: entry.notificationUuid,
      },
    });
  }

  if (entry.detector) {
    items.push({
      item: {
        key: 'detector',
        subject: 'Detector',
        value: entry.detector.name,
      },
    });
  }

  return items;
}

/**
 * Displays workflow fire history from the WorkflowFireHistory model.
 * Shows fire history aggregated by group, with count, last triggered time,
 * event ID, and optional detector information.
 * Supports time range filtering and pagination.
 */
export function WorkflowFireHistory({
  workflowId,
  organizationIdOrSlug,
}: WorkflowFireHistoryProps) {
  const [timeRange, setTimeRange] = useState<ChangeData>({
    relative: '24h',
    start: undefined,
    end: undefined,
    utc: false,
  });
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const {data, isPending, isError, getResponseHeader} = useWorkflowFireHistory(
    organizationIdOrSlug,
    workflowId,
    {
      statsPeriod: timeRange.relative ?? undefined,
      start: timeRange.start?.toISOString(),
      end: timeRange.end?.toISOString(),
      cursor,
    }
  );

  const pageLinks = getResponseHeader?.('Link') ?? null;

  // Sort by lastTriggered descending (most recent first)
  const entries = [...(data ?? [])].sort(
    (a, b) => new Date(b.lastTriggered).getTime() - new Date(a.lastTriggered).getTime()
  );

  const handleTimeRangeChange = (newTimeRange: ChangeData) => {
    setTimeRange(newTimeRange);
    setCursor(undefined);
  };

  return (
    <Disclosure defaultExpanded>
      <Disclosure.Title>
        <Heading as="h3">Fire History</Heading>
      </Disclosure.Title>
      <Disclosure.Content>
        <Stack gap="md">
          <TimeRangeSelector
            relative={timeRange.relative}
            start={timeRange.start}
            end={timeRange.end}
            utc={timeRange.utc}
            onChange={handleTimeRangeChange}
            showAbsolute
            showRelative
          />

          {isPending && (
            <Flex gap="md" align="center">
              <LoadingIndicator mini />
              <Text>Loading fire history...</Text>
            </Flex>
          )}

          {isError && (
            <Text variant="danger">
              Error loading fire history. Check the browser console.
            </Text>
          )}

          {!isPending && !isError && entries.length === 0 && (
            <Text variant="muted">
              No fire history found for this workflow in the selected time range.
            </Text>
          )}

          {!isPending && !isError && entries.length > 0 && (
            <Fragment>
              <Stack gap="sm">
                {entries.map(entry => (
                  <Container
                    key={`${entry.group.id}-${entry.lastTriggered}`}
                    padding="sm"
                    background="primary"
                    radius="md"
                    border="primary"
                  >
                    <Disclosure size="sm">
                      <Disclosure.Title>
                        <Flex gap="md" align="center" flex="1">
                          <Text size="sm" bold>
                            {formatTimestamp(entry.lastTriggered)}
                          </Text>

                          <Text size="sm">
                            Event:{' '}
                            <Text as="span" size="sm" monospace>
                              {entry.eventId}
                            </Text>
                          </Text>
                          <Tag variant="info">{entry.group.shortId}</Tag>
                        </Flex>
                      </Disclosure.Title>

                      <Disclosure.Content>
                        <StyledKeyValueCard>
                          <KeyValueData.Card contentItems={buildContentItems(entry)} />
                        </StyledKeyValueCard>
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
  }
`;
