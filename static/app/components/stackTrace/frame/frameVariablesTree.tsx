import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {InfoText} from '@sentry/scraps/info';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {getTooltipText} from 'sentry/components/events/meta/annotatedText/utils';
import {t, tn} from 'sentry/locale';
import type {FrameVariable} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';

import {getFrameVariableCopyText} from './getFrameVariableCopyText';
import {getStructuredDataConfig} from './getStructuredDataConfig';

interface Props {
  variables: readonly FrameVariable[];
  /** Override automatic expansion with the top-level variable names to open. */
  defaultExpanded?: readonly string[];
  platform?: PlatformKey;
}

const KEY_PREVIEW_LENGTH = 32;
const AUTO_EXPAND_MAX_ITEMS = 5;
const AUTO_EXPAND_MAX_DEPTH = 2;

/**
 * Preview whole child keys within a character budget, followed by an ellipsis
 * when more keys remain. An oversized first key is truncated instead.
 */
function getKeyPreview(children: readonly FrameVariable[]): string {
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

export function FrameVariablesTree({
  variables,
  defaultExpanded,
  platform = 'native',
}: Props) {
  return (
    <Stack aria-label={platform === 'native' ? t('Native variables') : t('Variables')}>
      {variables.map((variable, index) => (
        <Container
          key={variable.name}
          borderBottom={index < variables.length - 1 ? 'secondary' : undefined}
        >
          <Variable
            variable={variable}
            platform={platform}
            depth={0}
            defaultExpanded={defaultExpanded?.includes(variable.name)}
            autoExpand={defaultExpanded === undefined}
          />
        </Container>
      ))}
    </Stack>
  );
}

function Variable({
  variable,
  platform,
  depth,
  autoExpand,
  defaultExpanded,
}: {
  autoExpand: boolean;
  depth: number;
  platform: PlatformKey;
  variable: FrameVariable;
  defaultExpanded?: boolean;
}) {
  const copyText = useMemo(
    () => getFrameVariableCopyText(variable, platform),
    [variable, platform]
  );
  const isCollection = variable.kind === 'object' || variable.kind === 'array';
  const hasChildren = isCollection && variable.children.length > 0;
  const totalCount = isCollection
    ? Math.max(variable.children.length, variable.meta?.len ?? 0)
    : 0;
  const shouldAutoExpand =
    autoExpand &&
    hasChildren &&
    depth < AUTO_EXPAND_MAX_DEPTH &&
    totalCount <= AUTO_EXPAND_MAX_ITEMS;
  const [expanded, setExpanded] = useState(defaultExpanded ?? shouldAutoExpand);
  const truncatedCount = isCollection ? totalCount - variable.children.length : 0;
  const name =
    depth === 0 ? variable.name.replace(/^['"](.*)['"]$/, '$1') : variable.name;
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
        title={name}
        maxWidth={400}
      >
        {name}
      </VariableName>
      {variable.type && (
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
      )}
    </Stack>
  );

  const summary =
    isCollection &&
    (!hasChildren && truncatedCount > 0 ? (
      // eslint-disable-next-line @sentry/scraps/prefer-info-text -- Omitted values use a plain placeholder without a dotted underline.
      <Tooltip
        skipWrapper
        title={
          ruleId === undefined ? undefined : getTooltipText({rule_id: ruleId, remark})
        }
      >
        <Text size="xs" variant="muted" tabIndex={ruleId === undefined ? undefined : 0}>
          {variable.kind === 'array' ? '[ ' : '{ '}
          {tn('Omitted (%s item)', 'Omitted (%s items)', truncatedCount)}
          {variable.kind === 'array' ? ' ]' : ' }'}
        </Text>
      </Tooltip>
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
                aria-label={expanded ? t('Collapse %s', name) : t('Expand %s', name)}
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
      <Grid
        columns="minmax(0, 1fr) 20px"
        gap="xs"
        align="start"
        borderLeft="secondary"
        padding={depth > 0 ? 'sm md' : 'md'}
        minWidth="0"
      >
        <Stack minWidth="0" align="start">
          {isCollection ? (
            (!hasChildren || !expanded) &&
            (hasChildren ? (
              <SummaryButton
                variant="transparent"
                size="zero"
                aria-label={t('Expand %s', name)}
                onClick={() => setExpanded(true)}
              >
                {summary}
              </SummaryButton>
            ) : (
              summary
            ))
          ) : (
            <ScalarValue variable={variable} platform={platform} />
          )}
        </Stack>
        {copyText !== undefined && (
          <VariableCopyButton
            text={copyText}
            size="zero"
            variant="transparent"
            aria-label={t('Copy %s value', name)}
            tooltipProps={{title: t('Copy value')}}
          />
        )}
      </Grid>
    </VariableRow>
  );

  if (!isCollection || !hasChildren) {
    return row;
  }

  return (
    <Disclosure expanded={expanded} onExpandedChange={setExpanded} width="100%" size="xs">
      {row}
      <VariableContent>
        {expanded && (
          <Stack>
            {variable.children.map(child => (
              <Variable
                key={child.name}
                variable={child}
                depth={depth + 1}
                platform={platform}
                autoExpand={shouldAutoExpand}
              />
            ))}
            {truncatedCount > 0 && (
              <Grid columns="minmax(0, 192px) minmax(0, 1fr)" width="100%" role="note">
                <Container />
                <Container borderLeft="secondary" padding="xs md" minWidth="0">
                  <Text as="div" variant="muted" size="xs">
                    {`(${tn('%s item truncated', '%s items truncated', truncatedCount)})`}
                  </Text>
                </Container>
              </Grid>
            )}
          </Stack>
        )}
      </VariableContent>
    </Disclosure>
  );
}

function ScalarValue({
  variable,
  platform,
}: {
  platform: PlatformKey;
  variable: Exclude<FrameVariable, {kind: 'object' | 'array'}>;
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
  const config = getStructuredDataConfig({platform});
  switch (kind) {
    case 'unavailable':
      value = null;
      break;
    case 'null':
      value = hasAnnotations
        ? null
        : (config.renderNull?.(variable.value ?? null) ??
          (platform === 'native' ? 'nullptr' : 'null'));
      break;
    case 'boolean':
      value =
        config.renderBoolean?.(variable.value === 'true' || variable.value === 'True') ??
        variable.value;
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

const VariableCopyButton = styled(CopyToClipboardButton)`
  opacity: 0;
  height: 20px;
  min-height: 0;
  width: 20px;
  padding: 0;
`;

const VariableRow = styled(Grid)`
  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:hover ${VariableCopyButton},
  &:focus-within ${VariableCopyButton} {
    opacity: 1;
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

const VariableValue = styled(Text)<{kind: FrameVariable['kind']}>`
  color: ${p =>
    p.kind === 'string'
      ? p.theme.tokens.content.success
      : p.kind === 'number' || p.kind === 'null'
        ? p.theme.tokens.content.accent
        : p.theme.tokens.content.primary};
`;
