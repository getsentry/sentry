import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {EventCard} from 'admin/views/alertsDebug/components/eventCard';
import type {WorkflowEventDebugFormData} from 'admin/views/alertsDebug/types';

interface AlertDebugFormProps {
  workflowId: number;
}

export function AlertDebugForm({workflowId}: AlertDebugFormProps) {
  const [eventIdInput, setEventIdInput] = useState('');
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [results, setResults] = useState<WorkflowEventDebugFormData | null>(null);

  const addEventId = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();

    const id = eventIdInput.trim();
    if (id && !eventIds.includes(id)) {
      setEventIds(prev => [...prev, id]);
      setEventIdInput('');
      // Clear results when adding new events
      setResults(null);
    }
  };

  const removeEventId = (idToRemove: string) => {
    setEventIds(prev => prev.filter(id => id !== idToRemove));
    // Clear results when removing events
    setResults(null);
  };

  const handleEvaluate = () => {
    if (eventIds.length === 0) {
      return;
    }
    setResults({
      workflowId,
      eventIds,
    });
  };

  const clearResults = () => {
    setResults(null);
  };

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Heading as="h2">Add Events to Evaluate</Heading>
        <Text as="p">
          Add events by their ID to evaluate the workflow's fast conditions. Each event
          will be looked up and displayed below.
        </Text>
      </Stack>

      <Stack gap="md">
        <Flex gap="sm">
          <Input
            type="text"
            placeholder="Event ID (e.g., abc123)"
            value={eventIdInput}
            onChange={e => setEventIdInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                addEventId(e);
              }
            }}
          />
          <Button onClick={addEventId}>Add Event</Button>
        </Flex>

        {eventIds.length > 0 && (
          <Stack gap="sm">
            <Text bold>Events to Evaluate:</Text>
            <Stack gap="sm">
              {eventIds.map(eventId => (
                <EventCard key={eventId} eventId={eventId} onRemove={removeEventId} />
              ))}
            </Stack>
          </Stack>
        )}

        <Text as="p" variant="muted" size="sm">
          <Text italic bold>
            Note:&nbsp;
          </Text>
          Slow conditions do not evaluate, as they require state + time to evaluate
          correctly.
        </Text>
      </Stack>

      {/* Evaluate button */}
      {eventIds.length > 0 && !results && (
        <Flex justify="end">
          <Button priority="primary" onClick={handleEvaluate}>
            Evaluate Events
          </Button>
        </Flex>
      )}

      {/* Results section */}
      {results && (
        <Stack gap="md">
          <Heading as="h3">Evaluation Results</Heading>
          <Container background="tertiary" padding="md" radius="md">
            <CodeBlock language="json">{JSON.stringify(results, null, 2)}</CodeBlock>
          </Container>
          <Flex justify="end">
            <Button onClick={clearResults}>Clear Results</Button>
          </Flex>
        </Stack>
      )}
    </Stack>
  );
}
