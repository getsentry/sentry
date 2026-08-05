import {Fragment, useRef, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code';
import {Flex, Stack, Surface} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

const STREAMING_CHUNKS = [
  'Investigating the issue in ',
  '`AuthService.validate()`...\n\n',
  'The session validation middleware rejects requests with a `401 Unauthorized` when the token appears expired. This affects roughly 12% of users during daylight saving transitions, as the expiration window straddles the clock change.\n\n',
  '## Root Cause\n\n',
  'The token expiration check uses **UTC timestamps** ',
  'but the session store uses **local time**, ',
  'causing a mismatch during DST transitions.\n\n',
  '## Suggested Fix\n\n',
  'Normalize all timestamps to UTC before comparison:\n\n',
  '```python\nfrom datetime import datetime, timezone\n\n',
  'def validate_token(token):\n',
  '    now = datetime.now(timezone.utc)\n',
  '    return token.expires_at > now\n```\n\n',
  'This ensures consistent behavior regardless of server timezone.\n\n',
];

export function StreamingDemo() {
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
      <Markdown raw={text} variant="streaming" />
    </Stack>
  );
}

export function CustomComponentsDemo() {
  return (
    <Markdown
      raw={CUSTOM_COMPONENTS_MD}
      components={{
        Link: ({href, children}) => (
          <a href={href} style={{color: 'var(--pink400)', fontWeight: 'bold'}}>
            {children}
          </a>
        ),
        Text: ({children}) => {
          const parts = children.split(/(SENTRY-\d+)/);
          return (
            <Fragment>
              {parts.map((part, i) =>
                /SENTRY-\d+/.test(part) ? (
                  <a
                    key={i}
                    href={`/issues/${part}/`}
                    style={{
                      color: 'var(--purple400)',
                      textDecoration: 'underline',
                    }}
                  >
                    {part}
                  </a>
                ) : (
                  part
                )
              )}
            </Fragment>
          );
        },
      }}
    />
  );
}

const TAG_DEMO_MD = `Investigating {% ref type="issue" id="PROJ-123" /%} in the auth middleware.

{% artifact type="root-cause" %}
{"description":"Race condition in session refresh","severity":"high"}
{% /artifact %}

The fix involves normalizing timestamps to UTC. See {% ref type="event" id="abc123" /%} for the stack trace.`;

export function TagDemo() {
  return (
    <Markdown
      raw={TAG_DEMO_MD}
      components={{
        Tag: ({level, attrs, data}) => {
          if (level === 'inline') {
            return (
              <InlineCode variant="neutral">
                {attrs.type}({attrs.id})
              </InlineCode>
            );
          }
          const typedData = data as Record<string, string> | undefined;
          return (
            <Surface variant="overlay" elevation="medium" padding="lg">
              <Stack gap="lg">
                <Flex gap="sm" align="center">
                  <Flex flexGrow={1}>
                    <Text>{attrs.type}</Text>
                  </Flex>
                  <Text>severity</Text>
                  <Text variant="danger">{typedData?.severity}</Text>
                </Flex>
                {typedData?.description ? (
                  <Flex borderTop="primary" paddingTop="lg">
                    <Text>{typedData.description}</Text>
                  </Flex>
                ) : null}
              </Stack>
            </Surface>
          );
        },
      }}
    />
  );
}

const CUSTOM_COMPONENTS_MD = `The issue SENTRY-1234 was caused by a race condition in the auth flow.

See the [documentation](https://docs.sentry.io) for more details.

Related: SENTRY-5678 and SENTRY-9012.`;
