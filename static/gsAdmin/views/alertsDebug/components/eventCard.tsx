import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconClose} from 'sentry/icons';

import {useDiscoveryEvent} from 'admin/views/alertsDebug/hooks/useDiscoveryEvent';

interface EventCardProps {
  eventId: string;
  onRemove: (eventId: string) => void;
  organizationId: string;
}

// Fields shown in the header - exclude from details view
function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Displays event information in a card format with expandable details.
 * Fetches minimal data initially, then loads full details on expansion.
 */
export function EventCard({eventId, onRemove, organizationId}: EventCardProps) {
  const {data: event, isPending, isError} = useDiscoveryEvent(organizationId, eventId);

  return (
    <Container padding="sm" background="primary" radius="md" border="primary">
      {isError && (
        <Flex justify="between" align="center">
          <Text variant="danger">Error loading event {eventId}</Text>
          <Button
            size="xs"
            priority="transparent"
            icon={<IconClose />}
            aria-label={`Remove event ${eventId}`}
            onClick={() => onRemove(eventId)}
          />
        </Flex>
      )}

      {isPending && (
        <Flex gap="md" align="center">
          <LoadingIndicator mini />
          <Text>Loading event {eventId}...</Text>
        </Flex>
      )}

      {!isPending && !isError && event && (
        <Flex gap="sm" align="start">
          <Disclosure size="sm" style={{flex: 1}}>
            <Disclosure.Title>
              <Flex gap="md" align="center" flex="1">
                <Text size="sm" variant="muted">
                  {event.timestamp ? formatTimestamp(event.timestamp) : 'Unknown time'}
                </Text>
                {event.platform && <Tag variant="info">{event.platform}</Tag>}
                <Text
                  size="sm"
                  bold
                  style={{overflow: 'hidden', textOverflow: 'ellipsis'}}
                >
                  {event.title || event.message || 'Untitled Event'}
                </Text>
              </Flex>
            </Disclosure.Title>

            <Disclosure.Content>
              <Stack gap="sm" paddingTop="sm">
                {event.message && event.message !== event.title && (
                  <Text size="sm" variant="muted">
                    {event.message}
                  </Text>
                )}
                <Text size="sm" variant="muted">
                  ID: {event.id}
                </Text>
              </Stack>
            </Disclosure.Content>
          </Disclosure>
          <Button
            size="xs"
            priority="transparent"
            icon={<IconClose />}
            aria-label={`Remove event ${eventId}`}
            onClick={() => onRemove(eventId)}
          />
        </Flex>
      )}
    </Container>
  );
}
