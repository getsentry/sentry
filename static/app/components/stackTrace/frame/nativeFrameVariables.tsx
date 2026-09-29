import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {InfoText} from '@sentry/scraps/info';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {getTooltipText} from 'sentry/components/events/meta/annotatedText/utils';
import {t, tn} from 'sentry/locale';
import type {NativeFrameVariable} from 'sentry/types/event';

interface Props {
  variables: readonly NativeFrameVariable[];
  defaultExpanded?: readonly string[];
}

const KEY_PREVIEW_LENGTH = 24;

/**
 * Preview whole child keys within a character budget, followed by an ellipsis
 * when more keys remain. An oversized first key is truncated instead.
 */
function getKeyPreview(children: readonly NativeFrameVariable[]): string {
  const [first, ...remaining] = children;
  if (!first) {
    return '';
  }
  if (first.name.length > KEY_PREVIEW_LENGTH) {
    return `${first.name.slice(0, KEY_PREVIEW_LENGTH - 1)}…`;
  }

  let preview = first.name;
  for (const {name} of remaining) {
    const next = `${preview}, ${name}`;
    if (next.length > KEY_PREVIEW_LENGTH) {
      return `${preview}, …`;
    }
    preview = next;
  }
  return preview;
}

export function NativeFrameVariables({variables, defaultExpanded = []}: Props) {
  return (
    <Stack aria-label={t('Native variables')}>
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
  const isCollection = variable.kind === 'object' || variable.kind === 'array';
  const hasChildren = isCollection && variable.children.length > 0;
  const totalCount = isCollection
    ? Math.max(variable.children.length, variable.meta?.len ?? 0)
    : 0;
  const truncatedCount = isCollection ? totalCount - variable.children.length : 0;
  const [ruleId, remark] = variable.meta?.rem?.[0] ?? [];
  const label = (
    <Stack minWidth="0" gap="2xs" align="start">
      <VariableName
        as="div"
        monospace
        size="sm"
        bold={depth === 0}
        nested={depth > 0}
        density="comfortable"
        mode="overflowOnly"
        title={variable.name}
        maxWidth={400}
      >
        {variable.name}
      </VariableName>
      <InfoText
        as="div"
        monospace
        size="xs"
        variant="muted"
        mode="overflowOnly"
        title={variable.type}
        maxWidth={400}
      >
        {variable.type}
      </InfoText>
    </Stack>
  );

  const summary =
    isCollection &&
    (!hasChildren && truncatedCount > 0 ? (
      <InfoText
        monospace
        size="xs"
        variant="muted"
        title={
          ruleId === undefined ? undefined : getTooltipText({rule_id: ruleId, remark})
        }
      >
        {tn('%s item truncated', '%s items truncated', truncatedCount)}
      </InfoText>
    ) : (
      <Text monospace size="xs" variant="muted" ellipsis>
        {variable.kind === 'array' ? '[ ' : '{ '}
        {tn('%s item', '%s items', totalCount)}
        {variable.kind === 'object' &&
          hasChildren &&
          ` · ${getKeyPreview(variable.children)}`}
        {variable.kind === 'array' ? ' ]' : ' }'}
      </Text>
    ));

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
        {hasChildren ? (
          <Grid columns="18px minmax(0, 1fr)" align="center">
            <CaretContainer>
              <VariableTitle
                aria-label={
                  expanded
                    ? t('Collapse %s', variable.name)
                    : t('Expand %s', variable.name)
                }
              />
            </CaretContainer>
            {label}
          </Grid>
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
        {isCollection ? (
          (!hasChildren || !expanded) &&
          (hasChildren ? (
            <SummaryButton
              variant="transparent"
              size="zero"
              aria-label={t('Expand %s', variable.name)}
              onClick={() => setExpanded(true)}
            >
              {summary}
            </SummaryButton>
          ) : (
            summary
          ))
        ) : (
          <ScalarValue variable={variable} />
        )}
        {expanded && hasChildren && truncatedCount > 0 && (
          <Text variant="muted" size="xs">
            {`(${tn('%s item truncated', '%s items truncated', truncatedCount)})`}
          </Text>
        )}
      </Stack>
    </VariableRow>
  );

  if (!isCollection || !hasChildren) {
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

function ScalarValue({
  variable,
}: {
  variable: Exclude<NativeFrameVariable, {kind: 'object' | 'array'}>;
}) {
  const {kind, meta} = variable;
  const hasAnnotations = Boolean(
    meta?.rem?.length || meta?.chunks?.length || meta?.err?.length
  );

  if (kind === 'unavailable' && !hasAnnotations) {
    return (
      <Text monospace size="sm" variant="muted" density="comfortable">
        {t('Unavailable')}
      </Text>
    );
  }

  let value: string | null;
  switch (kind) {
    case 'unavailable':
      value = null;
      break;
    case 'null':
      value = hasAnnotations ? null : 'nullptr';
      break;
    case 'string':
      value = hasAnnotations
        ? variable.value
        : JSON.stringify(variable.value).slice(1, -1);
      break;
    default:
      value = variable.value;
  }

  return (
    <VariableValue
      monospace
      size="sm"
      kind={kind}
      density="comfortable"
      wrap="pre-wrap"
      wordBreak="break-word"
    >
      {kind === 'string' && '"'}
      <AnnotatedText value={value} meta={meta} />
      {kind === 'string' && '"'}
    </VariableValue>
  );
}

const VariableRow = styled(Grid)`
  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    border-left: 2px solid transparent;
    pointer-events: none;
  }

  &:hover::before {
    border-left-color: ${p => p.theme.tokens.border.accent.vibrant};
  }
`;

const NameCell = styled(Container)<{depth: number}>`
  padding-left: ${p => 12 + p.depth * 16}px;
`;

const CaretContainer = styled(Container)`
  /* Only the caret button owns the disclosure's hover/active background. */
  > div:hover,
  > div:active {
    background: transparent;
  }
`;

const SummaryButton = styled(Button)`
  height: auto;
  min-height: 0;
  max-width: 100%;
  padding: 0 2px;
  border-radius: 2px;
`;

const VariableTitle = styled(Disclosure.Title)`
  position: relative;
  left: -4px;
  height: 20px;
  min-height: 20px;
  min-width: 0;
  flex-grow: 0;
  flex-shrink: 0;
  justify-content: center;
  padding: 0;
  width: 20px;
  border-radius: 2px;

  &&:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &&:active {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;

const VariableContent = styled(Disclosure.Content)`
  padding: 0;
`;

const VariableName = styled(InfoText)<{nested: boolean}>`
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
