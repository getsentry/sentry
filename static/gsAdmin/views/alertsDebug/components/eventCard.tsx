import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconClose} from 'sentry/icons';

import {EventFixture, MOCK_EVENTS} from 'admin/views/alertsDebug/fixtures';
import {useAdminEvent} from 'admin/views/alertsDebug/hooks/useAdminEvent';

interface EventCardProps {
  eventId: string;
  onRemove: (eventId: string) => void;
}

/**
 * Displays event information in a card format with loading, error, and success states.
 * Falls back to mock data when the API returns an error (for development).
 */
export function EventCard({eventId, onRemove}: EventCardProps) {
  const {data: apiEvent, isPending, isError} = useAdminEvent(eventId);

  const mockEvent = MOCK_EVENTS[eventId] ?? EventFixture({eventID: eventId});
  const event = isError ? mockEvent : apiEvent;

  return (
    <Container padding="md" background="secondary" radius="md" border="primary">
      {isPending ? (
        <Flex gap="md" align="center">
          <LoadingIndicator mini />
          <Text>Loading event {eventId}...</Text>
        </Flex>
      ) : (
        <Flex gap="md" justify="between" align="start">
          <Stack gap="xs" flex="1">
            <Flex gap="sm" align="center" wrap="wrap">
              <Text bold>{event?.title || 'Untitled Event'}</Text>
              {event?.platform && <Tag>{event.platform}</Tag>}
              {isError && <Tag variant="warning">Mock Data</Tag>}
            </Flex>
            {event?.message && event.message !== event.title && (
              <Text variant="muted" size="sm">
                {event.message}
              </Text>
            )}
            <Flex gap="md">
              <Text size="sm" variant="muted">
                ID: {event?.eventID}
              </Text>
              {event?.dateCreated && (
                <Text size="sm" variant="muted">
                  Created: {new Date(event.dateCreated).toLocaleString()}
                </Text>
              )}
            </Flex>
          </Stack>

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
