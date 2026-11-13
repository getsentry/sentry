import {useState} from 'react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {
  DebuggerArtifact,
  DebuggerJsonValue,
} from 'sentry/utils/workflowEngineDebuggerApiOptions';

import {
  DiagnosticJson,
  PropertyTable,
} from 'admin/components/workflowEngine/diagnosticData';

const timestampFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
});

const evaluationKeys = [
  'evaluation_type',
  'evaluation_phase',
  'outcome',
  'triggered',
  'error',
  'triggered_action_ids',
];
const idKeys = ['workflow_id', 'detector_id', 'group_id', 'event_id'];

const labels = {itemId: 'Artifact ID'};

function selectAttributes(
  attributes: DebuggerArtifact['attributes'],
  keys: string[]
): Record<string, DebuggerJsonValue> {
  return Object.fromEntries(
    keys.flatMap(key => {
      const value = attributes[key];
      return value === undefined ? [] : [[key, value]];
    })
  );
}

function ArtifactCard({artifact, index}: {artifact: DebuggerArtifact; index: number}) {
  const [expanded, setExpanded] = useState(false);
  const timestamp = new Date(artifact.timestamp);
  const readableTimestamp = Number.isNaN(timestamp.getTime())
    ? artifact.timestamp
    : timestampFormat.format(timestamp);

  return (
    <Stack
      gap="lg"
      padding={{xs: 'md', md: 'xl'}}
      border="primary"
      radius="md"
      background="primary"
      minWidth="0"
    >
      <Stack gap="sm">
        <Heading as="h3" size="md">
          Artifact {index + 1}
        </Heading>
        <Text size="md">
          <time dateTime={artifact.timestamp}>{readableTimestamp}</time>
        </Text>
      </Stack>
      <Container containerType="inline-size" minWidth="0">
        <Grid
          columns={{xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))'}}
          gap="xl"
          align="start"
        >
          <Container minWidth="0">
            <PropertyTable
              caption="Evaluation and Result"
              data={selectAttributes(artifact.attributes, evaluationKeys)}
              labels={labels}
            />
          </Container>
          <Container minWidth="0">
            <PropertyTable
              caption="Available IDs"
              data={{
                projectId: artifact.projectId,
                itemId: artifact.itemId,
                traceId: artifact.traceId,
                ...selectAttributes(artifact.attributes, idKeys),
              }}
              labels={labels}
            />
          </Container>
        </Grid>
      </Container>
      <Container borderTop="primary" paddingTop="lg" minWidth="0">
        <Disclosure expanded={expanded} onExpandedChange={setExpanded}>
          <Disclosure.Title>
            <Text size="md" bold>
              JSON attributes
            </Text>
          </Disclosure.Title>
          <Disclosure.Content>
            {expanded && <DiagnosticJson value={artifact.attributes} />}
          </Disclosure.Content>
        </Disclosure>
      </Container>
    </Stack>
  );
}

export function WorkflowEngineArtifacts({artifacts}: {artifacts: DebuggerArtifact[]}) {
  return (
    <Stack gap="xl">
      {artifacts.map((artifact, index) => (
        <ArtifactCard
          key={`${artifact.projectId}:${artifact.itemId}`}
          artifact={artifact}
          index={index}
        />
      ))}
    </Stack>
  );
}
