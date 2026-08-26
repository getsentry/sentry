import {useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {SEER_EMBED_SCHEMAS} from 'sentry/components/seer/markdown/embeds/schemas';
import {Demo} from 'sentry/stories';
import {replayListApiOptions} from 'sentry/utils/replays/replayListApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const BASIC_MD = `## Root Cause

The session validation middleware rejects requests with a \`401 Unauthorized\` when the token appears expired. This affects roughly 12% of users during **daylight saving transitions**, as the expiration window straddles the clock change.

### Suggested Fix

Normalize all timestamps to UTC before comparison:

\`\`\`python
from datetime import datetime, timezone

def validate_token(token):
    now = datetime.now(timezone.utc)
    return token.expires_at > now
\`\`\`
`;

export function BasicDemo() {
  return <SeerMarkdown raw={BASIC_MD} />;
}

const LINKIFY_MD = `The issue SENTRY-1234 was caused by a race condition in the auth flow. Related issues include \`PROJECT-5678\` and BACKEND-9012.

See the [documentation](https://docs.sentry.io) for more details.`;

export function LinkifyDemo() {
  return <SeerMarkdown raw={LINKIFY_MD} />;
}

const STREAMING_CHUNKS = [
  'Investigating the issue in ',
  '`AuthService.validate()`...\n\n',
  'The error started occurring {% timestamp %}',
  '{"value":"2025-07-15T14:30:00Z","format":"relative"}',
  '{% /timestamp %}.\n\n',
  '## Root Cause\n\n',
  'The token expiration check uses **UTC timestamps** ',
  'but the session store uses **local time**.\n\n',
  '```python\ndef validate_token(token):\n',
  '    now = datetime.now(timezone.utc)\n',
  '    return token.expires_at > now\n```\n',
];

export function StreamingEmbedExamples() {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const cancelRef = useRef(false);

  function startStream() {
    cancelRef.current = false;
    setIsStreaming(true);
    setText('');

    let buffer = '';
    let i = 0;

    function nextChunk() {
      if (cancelRef.current || i >= STREAMING_CHUNKS.length) {
        setIsStreaming(false);
        return;
      }
      buffer += STREAMING_CHUNKS[i];
      setText(buffer);
      i++;
      setTimeout(nextChunk, 150 + Math.random() * 200);
    }

    nextChunk();
  }

  function reset() {
    cancelRef.current = true;
    setIsStreaming(false);
    setText('');
  }

  return (
    <Stack gap="lg" flexGrow={1} maxWidth="72ch">
      <Flex gap="md">
        <Button variant="primary" size="sm" onClick={startStream} disabled={isStreaming}>
          Start Stream
        </Button>
        <Button size="sm" onClick={reset} disabled={!text}>
          Reset
        </Button>
      </Flex>
      <SeerMarkdown raw={text} variant="streaming" />
    </Stack>
  );
}

function formatTag(name: string, data: unknown): string {
  return `{% ${name} %}${JSON.stringify(data)}{% /${name} %}`;
}

function useReplayExampleData(): Record<string, unknown> | undefined {
  const organization = useOrganization();
  const {data} = useQuery(
    replayListApiOptions({
      options: {query: {sort: '-started_at'}},
      organization,
      queryReferrer: 'replayList',
    })
  );

  const replay = data?.data?.[0];
  if (!replay?.started_at) {
    return undefined;
  }

  return {
    id: replay.id,
    eventTimestamp: String(replay.started_at),
  };
}

function LevelDemo({
  name,
  level,
  exampleData,
  isLargeBlock,
}: {
  exampleData: Record<string, unknown>;
  level: string;
  name: string;
  isLargeBlock?: boolean;
}) {
  const tag = formatTag(name, exampleData);
  const md = level === 'inline' ? `Lorem ipsum ${tag} dolor sit amet.` : tag;

  return (
    <Stack gap="sm">
      <Text size="sm" bold>
        {level}
      </Text>
      <Demo maxHeight={isLargeBlock ? '900px' : undefined}>
        <SeerMarkdown raw={md} />
      </Demo>
      <CodeBlock language="markdown" dark>
        {md}
      </CodeBlock>
    </Stack>
  );
}

export function EmbedExamples({name}: {name: string}) {
  const schema = SEER_EMBED_SCHEMAS[name as keyof typeof SEER_EMBED_SCHEMAS];
  const replayData = useReplayExampleData();

  if (!schema) {
    return null;
  }

  const exampleData =
    name === 'replay' && replayData ? replayData : (schema.examples?.[0]?.data ?? {});

  const isLargeBlock = name === 'replay';

  return (
    <Stack gap="md">
      <Text size="sm" variant="muted">
        Level: {schema.level.join(', ')}
        {'featureFlag' in schema ? ` · Flag: ${schema.featureFlag}` : null}
      </Text>
      <Text size="sm" variant="muted">
        {schema.description}
      </Text>
      <Stack gap="lg">
        {schema.level.map(level => (
          <LevelDemo
            key={level}
            name={name}
            level={level}
            exampleData={exampleData}
            isLargeBlock={isLargeBlock && level === 'block'}
          />
        ))}
      </Stack>
    </Stack>
  );
}
