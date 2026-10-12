import {SeerMarkdown} from 'sentry/components/seer/markdown';

const ISSUE = '{% issue %}{"id":"JAVASCRIPT-22SP"}{% /issue %}';
const TIMESTAMP =
  '{% timestamp %}{"value":"2025-07-15T14:30:00Z","format":"relative"}{% /timestamp %}';
const DSN =
  '{% dsn %}{"value":"https://examplePublicKey@o0.ingest.sentry.io/0"}{% /dsn %}';

const TABLE_MD = `| Issue | First seen | Owner |
| --- | --- | --- |
| ${ISSUE} | ${TIMESTAMP} | #frontend |
| ${ISSUE} | ${TIMESTAMP} | #backend |
`;

export function TablePlacementDemo() {
  return <SeerMarkdown raw={TABLE_MD} />;
}

const LIST_INLINE_MD = `Where I'd focus next:

- Start with ${ISSUE}, first seen ${TIMESTAMP}.
- Then check ${ISSUE}, since the timeouts may cascade.
`;

export function ListInlinePlacementDemo() {
  return <SeerMarkdown raw={LIST_INLINE_MD} />;
}

const LIST_LEADING_MD = `Where I'd focus next:

- ${ISSUE} is the most urgent, first seen ${TIMESTAMP}.
- ${ISSUE} is worth a look too, since the timeouts may cascade.
`;

export function ListLeadingTagDemo() {
  return <SeerMarkdown raw={LIST_LEADING_MD} />;
}

const LIST_BLOCK_MD = `Set up the SDK:

1. Install the package.

2. Configure the client with your DSN:

   ${DSN}

3. Deploy and verify events arrive.
`;

export function ListBlockPlacementDemo() {
  return <SeerMarkdown raw={LIST_BLOCK_MD} />;
}

const BASELINE_MD = `Configure the client with your DSN:

${DSN}

Then deploy and verify events arrive.
`;

export function BaselineBlockDemo() {
  return <SeerMarkdown raw={BASELINE_MD} />;
}
