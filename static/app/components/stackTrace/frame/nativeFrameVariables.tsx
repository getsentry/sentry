import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';

/** Presentation model for the native variables preview, independent of frame.vars. */
export type NativeFrameVariable = {
  name: string;
  type: string;
} & (
  | {children: readonly NativeFrameVariable[]; kind: 'object'}
  | {kind: 'number' | 'string' | 'enum' | 'pointer'; value: string}
  | {kind: 'null'}
  | {kind: 'unavailable'}
);

interface Props {
  variables: readonly NativeFrameVariable[];
  defaultExpanded?: readonly string[];
}

export function NativeFrameVariables({variables, defaultExpanded = []}: Props) {
  return (
    <Stack borderTop="primary" aria-label={t('Native variables')}>
      {variables.map((variable, index) => (
        <Container
          key={variable.name}
          borderBottom={index < variables.length - 1 ? 'secondary' : undefined}
        >
          <Variable
            variable={variable}
            depth={0}
            defaultExpanded={defaultExpanded.includes(variable.name)}
          />
        </Container>
      ))}
    </Stack>
  );
}

function Variable({
  variable,
  depth,
  defaultExpanded = false,
}: {
  depth: number;
  variable: NativeFrameVariable;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const label = (
    <Stack minWidth="0" gap="xs" align="start">
      <VariableName
        as="div"
        monospace
        size="sm"
        bold={depth === 0}
        nested={depth > 0}
        density="comfortable"
        ellipsis
        title={variable.name}
      >
        {variable.name}
      </VariableName>
      <Text as="div" monospace size="xs" variant="muted" ellipsis title={variable.type}>
        {variable.type}
      </Text>
    </Stack>
  );

  const row = (
    <VariableRow
      columns="minmax(0, 192px) minmax(0, 1fr)"
      width="100%"
      position="relative"
    >
      <NameCell
        depth={depth}
        paddingTop={depth > 0 ? 'sm' : 'md'}
        paddingBottom={depth > 0 ? 'sm' : 'md'}
        paddingRight="md"
        minWidth="0"
      >
        {variable.kind === 'object' ? (
          <VariableTitle
            aria-label={
              expanded ? t('Collapse %s', variable.name) : t('Expand %s', variable.name)
            }
          >
            {label}
          </VariableTitle>
        ) : (
          <Container paddingLeft="xl" minWidth="0">
            {label}
          </Container>
        )}
      </NameCell>
      <Stack
        borderLeft="secondary"
        padding={depth > 0 ? 'sm md' : 'md'}
        minWidth="0"
        align="start"
      >
        {variable.kind === 'object' ? (
          !expanded && (
            <SummaryButton
              variant="transparent"
              size="zero"
              aria-label={t('Expand %s', variable.name)}
              onClick={() => setExpanded(true)}
            >
              <Text monospace size="sm" variant="muted" density="comfortable">
                {'{ '}
                {tn('%s item', '%s items', variable.children.length)}
                {' }'}
              </Text>
            </SummaryButton>
          )
        ) : variable.kind === 'unavailable' ? (
          <Text monospace size="sm" variant="muted" density="comfortable">
            {t('Unavailable')}
          </Text>
        ) : (
          <VariableValue
            monospace
            size="sm"
            kind={variable.kind}
            density="comfortable"
            wrap="pre-wrap"
            wordBreak="break-word"
          >
            {variable.kind === 'null'
              ? 'nullptr'
              : variable.kind === 'string'
                ? JSON.stringify(variable.value)
                : variable.value}
          </VariableValue>
        )}
      </Stack>
    </VariableRow>
  );

  if (variable.kind !== 'object') {
    return row;
  }

  return (
    <Disclosure expanded={expanded} onExpandedChange={setExpanded} width="100%" size="xs">
      {row}
      <VariableContent>
        {expanded &&
          variable.children.map(child => (
            <Variable key={child.name} variable={child} depth={depth + 1} />
          ))}
      </VariableContent>
    </Disclosure>
  );
}

const VariableRow = styled(Grid)`
  &:hover,
  &:focus-within {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    border-left: 2px solid transparent;
    pointer-events: none;
  }

  &:hover::before,
  &:focus-within::before {
    border-left-color: ${p => p.theme.tokens.border.accent.vibrant};
  }
`;

const NameCell = styled(Container)<{depth: number}>`
  padding-left: ${p => 12 + p.depth * 16}px;

  /* The variable row owns the background instead of Disclosure's title wrapper. */
  > div:hover,
  > div:active {
    background: transparent;
  }
`;

const SummaryButton = styled(Button)`
  height: auto;
  min-height: 0;
  padding: 0;

  &&:hover,
  &&:active {
    background: transparent;
  }
`;

const VariableTitle = styled(Disclosure.Title)`
  height: auto;
  min-width: 0;
  padding: 0;
  text-align: left;
  width: 100%;
`;

const VariableContent = styled(Disclosure.Content)`
  padding: 0;
`;

const VariableName = styled(Text)<{nested: boolean}>`
  max-width: 100%;
  color: ${p =>
    p.nested ? p.theme.tokens.content.danger : p.theme.tokens.content.primary};
`;

const VariableValue = styled(Text)<{kind: NativeFrameVariable['kind']}>`
  color: ${p =>
    p.kind === 'string'
      ? p.theme.tokens.content.success
      : p.kind === 'number' || p.kind === 'null' || p.kind === 'pointer'
        ? p.theme.tokens.content.accent
        : p.theme.tokens.content.primary};
`;
