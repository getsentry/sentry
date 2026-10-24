import {useId, useMemo, useRef, useState} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import {IconNot} from '@sentry/icons/not';
import {IconWarning} from '@sentry/icons/warning';
import {useDebouncedValue} from '@tanstack/react-pacer';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {TextArea, type TextAreaProps} from '@sentry/scraps/textarea';
import {type FormSize} from '@sentry/scraps/theme';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tn} from 'sentry/locale';
import {
  tokenizeFingerprintRules,
  type FingerprintDiagnostic,
  type FingerprintDiagnosticCode,
  type FingerprintToken,
} from 'sentry/views/settings/projectIssueGrouping/fingerprintRulesSyntax';

const DIAGNOSTIC_MESSAGES: Record<FingerprintDiagnosticCode, (text?: string) => string> =
  {
    'glued-arrow': arrow => t('Add a space before "%s"', arrow),
    'invalid-syntax': () => t('Invalid syntax'),
    'lookalike-arrow': arrow => t('Use "->" instead of "%s"', arrow),
    'missing-arrow': () => t('Missing "->" before the fingerprint'),
    'unknown-attribute': name =>
      t('Unknown attribute "%s", only title is supported', name),
    'unknown-matcher': name => t('Unknown matcher "%s"', name),
    'inline-comment': () => t('This comment becomes part of the fingerprint'),
    'multiline-quote': () => t('Quoted value spans lines, missing a closing quote?'),
    'unknown-variable': name => t('Unknown variable "%s"', name),
    'unquoted-title': () => t('Unquoted title becomes part of the fingerprint'),
  };

const getMessage = ({code, text}: FingerprintDiagnostic) =>
  DIAGNOSTIC_MESSAGES[code](text);

function getLineNumber(text: string, offset: number) {
  return text.slice(0, offset).split('\n').length;
}

// The textarea normalizes line endings, so highlight the same text it displays
function normalizeNewlines(text: string) {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * Split the text wherever a token or diagnostic starts or ends, so each piece has one
 * token type and at most one underline.
 */
function getSegments(
  text: string,
  tokens: FingerprintToken[],
  diagnostics: FingerprintDiagnostic[]
) {
  const boundaries = new Set([0, text.length]);
  for (const {start, end} of [...tokens, ...diagnostics]) {
    boundaries.add(start);
    boundaries.add(end);
  }
  const points = [...boundaries].sort((a, b) => a - b);

  let tokenIndex = 0;
  return points.slice(0, -1).map((start, i) => {
    const end = points[i + 1]!;
    while (tokenIndex < tokens.length && tokens[tokenIndex]!.end <= start) {
      tokenIndex++;
    }
    const token = tokens[tokenIndex];
    const covering = diagnostics.filter(d => d.start <= start && d.end >= end);
    return {
      start,
      end,
      type: token && token.start <= start ? token.type : undefined,
      severity: covering.some(d => d.severity === 'error')
        ? 'error'
        : covering[0]?.severity,
    };
  });
}

function HighlightedRules({
  text,
  tokens,
  diagnostics,
}: {
  diagnostics: FingerprintDiagnostic[];
  text: string;
  tokens: FingerprintToken[];
}) {
  return getSegments(text, tokens, diagnostics).map(({start, end, type, severity}) =>
    type || severity ? (
      <span
        key={start}
        data-token={type}
        data-severity={severity}
        data-start={severity ? start : undefined}
        data-end={severity ? end : undefined}
      >
        {text.slice(start, end)}
      </span>
    ) : (
      text.slice(start, end)
    )
  );
}

function DiagnosticIcon({severity}: {severity: FingerprintDiagnostic['severity']}) {
  return severity === 'error' ? (
    <IconNot size="xs" variant="danger" />
  ) : (
    <IconWarning size="xs" variant="warning" />
  );
}

/**
 * Fingerprint rules with syntax highlighting, for showing rules that can't be edited.
 */
export function FingerprintRulesCode({rules}: {rules: string}) {
  const text = normalizeNewlines(rules);
  const {tokens} = tokenizeFingerprintRules(text);

  return (
    <Container background="secondary" padding="md lg" radius="md" width="100%">
      <Text as="div" monospace size="sm" wrap="pre-wrap">
        <Highlight>
          <HighlightedRules text={text} tokens={tokens} diagnostics={[]} />
        </Highlight>
      </Text>
    </Container>
  );
}

interface HoveredUnderline {
  diagnostics: FingerprintDiagnostic[];
  key: string;
  rect: {height: number; left: number; top: number; width: number};
}

interface FingerprintRulesEditorProps extends Omit<
  TextAreaProps,
  'autosize' | 'monospace' | 'onChange' | 'value'
> {
  onChange: (value: string) => void;
  value: string;
}

/**
 * A textarea for fingerprint rules that highlights the syntax and underlines mistakes that
 * would stop the rules from saving, or make them behave differently than they read.
 * Hovering an underline explains it, and a summary below lists them all.
 */
export function FingerprintRulesEditor({
  ref,
  value,
  onChange,
  onScroll,
  size = 'md',
  disabled,
  'aria-describedby': ariaDescribedBy,
  ...props
}: FingerprintRulesEditorProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMemo(() => mergeRefs(ref, textAreaRef), [ref, textAreaRef]);
  const summaryId = useId();
  const [hovered, setHovered] = useState<HoveredUnderline | null>(null);

  const text = normalizeNewlines(value);
  const {tokens, diagnostics} = tokenizeFingerprintRules(text);

  // Hold diagnostics back while typing, so a half-written rule isn't flagged. The summary
  // keeps showing the last settled ones so the layout doesn't jump.
  const [settledText] = useDebouncedValue(text, {wait: 500});
  const isSettled = settledText === text;
  const settledDiagnostics = isSettled
    ? diagnostics
    : tokenizeFingerprintRules(settledText).diagnostics;
  const errorCount = settledDiagnostics.filter(d => d.severity === 'error').length;
  const warningCount = settledDiagnostics.length - errorCount;

  // The highlight layer lets the mouse through to the textarea, so its underlines can't be
  // hovered directly. Find the one under the pointer instead.
  const handleMouseMove = (event: React.MouseEvent) => {
    const layer = layerRef.current;
    if (!layer || !isSettled) {
      return;
    }
    for (const span of layer.querySelectorAll<HTMLElement>('[data-severity]')) {
      for (const rect of span.getClientRects()) {
        // The wavy underline sits a little below the text
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom + 4
        ) {
          const start = Number(span.dataset.start);
          const end = Number(span.dataset.end);
          const covering = diagnostics.filter(d => d.start <= start && d.end >= end);
          const key = covering.map(d => `${d.code}-${d.start}`).join();
          // Moving along the same underline keeps the tooltip where it opened
          if (hovered?.key !== key) {
            const origin = layer.getBoundingClientRect();
            setHovered({
              key,
              diagnostics: covering,
              rect: {
                top: rect.top - origin.top,
                left: rect.left - origin.left,
                width: rect.width,
                height: rect.height,
              },
            });
          }
          return;
        }
      }
    }
    setHovered(null);
  };

  const selectDiagnostic = ({start, end}: FingerprintDiagnostic) => {
    textAreaRef.current?.focus();
    textAreaRef.current?.setSelectionRange(start, end);
  };

  return (
    <Stack gap="xs" width="100%">
      <Container
        position="relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        <EditorTextArea
          {...props}
          ref={mergedRef}
          value={value}
          onChange={e => {
            setHovered(null);
            onChange(e.target.value);
          }}
          onScroll={e => {
            if (layerRef.current) {
              layerRef.current.scrollTop = e.currentTarget.scrollTop;
              layerRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
            setHovered(null);
            onScroll?.(e);
          }}
          size={size}
          disabled={disabled}
          monospace
          autosize
          spellCheck={false}
          autoComplete="off"
          aria-describedby={
            [ariaDescribedBy, settledDiagnostics.length > 0 ? summaryId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
        />
        <HighlightLayer ref={layerRef} aria-hidden size={size} disabled={!!disabled}>
          <HighlightedRules
            text={text}
            tokens={tokens}
            diagnostics={isSettled ? diagnostics : []}
          />
          {/* Gives a trailing newline a line to occupy, like the textarea does */}
          {text.endsWith('\n') && ' '}
        </HighlightLayer>
        {hovered && isSettled ? (
          <Tooltip
            key={hovered.key}
            title={
              <Tooltip.Grid columns="max-content 1fr">
                {hovered.diagnostics.map(diagnostic => (
                  <Tooltip.Row
                    key={`${diagnostic.code}-${diagnostic.start}`}
                    leadingItems={<DiagnosticIcon severity={diagnostic.severity} />}
                  >
                    <Text>{getMessage(diagnostic)}</Text>
                  </Tooltip.Row>
                ))}
              </Tooltip.Grid>
            }
            maxWidth="none"
            forceVisible="delayed"
            position="top"
            skipWrapper
          >
            <TooltipAnchor style={hovered.rect} />
          </Tooltip>
        ) : null}
      </Container>
      {settledDiagnostics.length > 0 && (
        <Disclosure size="xs">
          <Disclosure.Title id={summaryId}>
            <Flex gap="md" align="center">
              {errorCount > 0 && (
                <Flex gap="xs" align="center">
                  <DiagnosticIcon severity="error" />
                  <Text size="sm" bold={false}>
                    {tn('%s error', '%s errors', errorCount)}
                  </Text>
                </Flex>
              )}
              {warningCount > 0 && (
                <Flex gap="xs" align="center">
                  <DiagnosticIcon severity="warning" />
                  <Text size="sm" bold={false}>
                    {tn('%s warning', '%s warnings', warningCount)}
                  </Text>
                </Flex>
              )}
            </Flex>
          </Disclosure.Title>
          <Disclosure.Content>
            <Stack as="ul" gap="xs" padding="0" margin="0">
              {settledDiagnostics.map(diagnostic => (
                <Flex
                  as="li"
                  key={`${diagnostic.code}-${diagnostic.start}`}
                  gap="sm"
                  align="center"
                >
                  <DiagnosticIcon severity={diagnostic.severity} />
                  <Text size="sm">
                    <Button
                      variant="link"
                      size="zero"
                      onClick={() => selectDiagnostic(diagnostic)}
                    >
                      {t('Line %s', getLineNumber(settledText, diagnostic.start))}
                    </Button>{' '}
                    {getMessage(diagnostic)}
                  </Text>
                </Flex>
              ))}
            </Stack>
          </Disclosure.Content>
        </Disclosure>
      )}
    </Stack>
  );
}

const highlightStyles = (theme: Theme) => css`
  [data-token='comment'] {
    color: ${theme.tokens.syntax.comment};
  }
  [data-token='negation'] {
    color: ${theme.tokens.syntax.keyWord};
  }
  [data-token='matcher'],
  [data-token='attribute'] {
    color: ${theme.tokens.syntax.property};
  }
  [data-token='pattern'],
  [data-token='string'] {
    color: ${theme.tokens.syntax.selector};
  }
  [data-token='punctuation'] {
    color: ${theme.tokens.content.secondary};
  }
  [data-token='arrow'] {
    color: ${theme.tokens.content.promotion};
  }
  [data-token='variable'] {
    color: ${theme.tokens.content.warning};
  }
  [data-token='invalid'] {
    color: ${theme.tokens.content.danger};
  }
  [data-severity] {
    text-decoration-line: underline;
    text-decoration-style: wavy;
    text-decoration-skip-ink: none;
    text-underline-offset: 0.2em;
  }
  [data-severity='error'] {
    text-decoration-color: ${theme.tokens.graphics.danger.vibrant};
  }
  [data-severity='warning'] {
    text-decoration-color: ${theme.tokens.graphics.warning.vibrant};
  }
`;

const Highlight = styled('span')`
  ${p => highlightStyles(p.theme)}
`;

// Matches TextArea, whose vertical padding centers one line in the input's height
const verticalPadding = (theme: Theme, size: FormSize) =>
  `calc((${theme.form[size].height} - ${theme.form[size].fontSize} * ${theme.font.lineHeight.comfortable}) / 2)`;

// Sits on top of the textarea, whose own text is transparent. It has the same box and
// font as TextArea so each character lines up, and lets clicks through to the textarea.
const HighlightLayer = styled('div')<{disabled: boolean; size: FormSize}>`
  position: absolute;
  inset: 0;
  overflow: hidden;
  scrollbar-gutter: stable;
  pointer-events: none;
  border: 1px solid transparent;
  padding: ${p => verticalPadding(p.theme, p.size)}
    ${p => p.theme.form[p.size].paddingRight}px;
  padding-left: ${p => p.theme.form[p.size].paddingLeft}px;
  font-family: ${p => p.theme.font.family.mono};
  font-weight: ${p => p.theme.font.weight.mono.regular};
  font-size: ${p => p.theme.form[p.size].fontSize};
  line-height: ${p => p.theme.font.lineHeight.comfortable};
  color: ${p => p.theme.tokens.content.primary};
  white-space: pre-wrap;
  overflow-wrap: break-word;
  ${p => p.disabled && 'opacity: 60%;'}
  ${p => highlightStyles(p.theme)}
`;

// Marks where an underline is, for its tooltip to point at
const TooltipAnchor = styled('span')`
  position: absolute;
  pointer-events: none;
`;

const EditorTextArea = styled(TextArea)`
  position: relative;
  color: transparent;
  caret-color: ${p => p.theme.tokens.content.primary};
  scrollbar-gutter: stable;

  &[disabled],
  &[aria-disabled='true'] {
    color: transparent;
  }

  &::selection {
    color: transparent;
    background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
  }
`;
