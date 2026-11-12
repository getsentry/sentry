import styled from '@emotion/styled';

import {CodeBlock} from '@sentry/scraps/codeBlock';
import {Container} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {DebuggerJsonValue} from 'sentry/utils/workflowEngineDebuggerApiOptions';

const PROPERTY_COLUMNS: TableColumnConfig[] = [
  {key: 'property', width: 'minmax(0, 2fr)', resizable: false},
  {key: 'value', width: 'minmax(0, 3fr)', resizable: false},
];

const ACRONYMS: Record<string, string> = {
  api: 'API',
  id: 'ID',
  ids: 'IDs',
  json: 'JSON',
  sdk: 'SDK',
  url: 'URL',
  urls: 'URLs',
  utc: 'UTC',
  uuid: 'UUID',
};

export function propertyLabel(key: string): string {
  const words = key
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .trim();

  if (!words) {
    return key || '"" (empty key)';
  }

  return words
    .split(/\s+/)
    .map(word => {
      const lowercase = word.toLowerCase();
      return Object.hasOwn(ACRONYMS, lowercase)
        ? ACRONYMS[lowercase]
        : word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function DiagnosticJson({value}: {value: DebuggerJsonValue}) {
  return (
    <Container width="100%" minWidth={0} maxWidth="100%" background="primary">
      <ReadableCodeBlock language="json" wrapMode="wrap" alwaysShowCopyButton>
        {JSON.stringify(value, null, 2)}
      </ReadableCodeBlock>
    </Container>
  );
}

function DiagnosticValue({value}: {value: DebuggerJsonValue}) {
  if (value !== null && typeof value === 'object') {
    return <DiagnosticJson value={value} />;
  }

  return (
    <Text
      as="div"
      size="md"
      density="comfortable"
      wrap="pre-wrap"
      wordBreak="break-word"
      monospace={typeof value !== 'string'}
    >
      {value === '' ? '"" (empty string)' : String(value)}
    </Text>
  );
}

export function PropertyTable({
  data,
  labels,
  caption,
}: {
  data: Record<string, DebuggerJsonValue>;
  caption?: string;
  labels?: Record<string, string>;
}) {
  const entries = Object.entries(data);

  return (
    <Container width="100%" minWidth={0} overflowX="auto" background="primary">
      <SimpleTable columns={PROPERTY_COLUMNS} customSections>
        {caption !== undefined && (
          <Container column="1 / -1" padding="md">
            {props => (
              <caption {...props}>
                <Text as="div" size="md" bold align="left">
                  {caption}
                </Text>
              </caption>
            )}
          </Container>
        )}
        <SimpleTable.Body>
          {entries.map(([key, value]) => (
            <SimpleTable.Row key={key}>
              <SimpleTable.RowCell
                role="rowheader"
                alignSelf="stretch"
                direction="column"
                align="stretch"
                padding="sm md"
              >
                <Text
                  as="div"
                  size="md"
                  bold
                  align="left"
                  density="comfortable"
                  wordBreak="break-word"
                >
                  {labels?.[key] ?? propertyLabel(key)}
                </Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell
                alignSelf="stretch"
                direction="column"
                align="stretch"
                padding="sm md"
              >
                <DiagnosticValue value={value} />
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          ))}
          {entries.length === 0 && (
            <SimpleTable.FullWidthRow>
              <Container padding="md">
                <Text size="md" variant="muted">
                  No properties available
                </Text>
              </Container>
            </SimpleTable.FullWidthRow>
          )}
        </SimpleTable.Body>
      </SimpleTable>
    </Container>
  );
}

// Both JSON elements expose this Prism class; override their small font without
// depending on the CodeBlock element hierarchy.
const ReadableCodeBlock = styled(CodeBlock)`
  && {
    --prism-block-background: ${p => p.theme.tokens.background.primary};
  }

  && .language-json {
    font-size: ${p => p.theme.font.size.md};
    line-height: ${p => p.theme.font.lineHeight.comfortable};
  }
`;
