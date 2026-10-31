import {useId, useMemo, useRef} from 'react';
import {type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import {IconNot} from '@sentry/icons/not';
import {IconWarning} from '@sentry/icons/warning';
import * as Sentry from '@sentry/react';
import {useDebouncedValue} from '@tanstack/react-pacer';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {TextArea, type TextAreaProps} from '@sentry/scraps/textarea';
import {type FormSize} from '@sentry/scraps/theme';

import {t, tn} from 'sentry/locale';
import {
  tokenizeFingerprintRules,
  type FingerprintDiagnostic,
  type FingerprintDiagnosticCode,
  type FingerprintToken,
} from 'sentry/views/settings/projectIssueGrouping/fingerprintRulesSyntax';

// Each gets the text it underlines
const DIAGNOSTIC_MESSAGES: Record<FingerprintDiagnosticCode, (text: string) => string> = {
  'glued-arrow': () => t('Add a space before "->"'),
  'invalid-syntax': () => t('Invalid syntax'),
  'lookalike-arrow': arrow => t('Use "->" instead of "%s"', arrow),
  'missing-arrow': () => t('Missing "->" before the fingerprint'),
  'inline-comment': () => t('This comment becomes part of the fingerprint'),
  'unquoted-title': () => t('Unquoted title becomes part of the fingerprint'),
};

function getLineNumber(text: string, offset: number) {
  return text.slice(0, offset).split('\n').length;
}

// The textarea normalizes line endings, so highlight the same text it displays
function normalizeNewlines(text: string) {
  return text.replace(/\r\n?/g, '\n');
}

// The highlighting is only a hint, so a tokenizer bug shows plain text instead of breaking
// the field. The backend still validates the rules on save.
function tokenize(text: string) {
  try {
    return tokenizeFingerprintRules(text);
  } catch (error) {
    Sentry.captureException(error);
    return {tokens: [], diagnostics: []};
  }
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
  // Sorted, starting at 0
  const [, ...ends] = [...boundaries].sort((a, b) => a - b);

  let start = 0;
  let tokenIndex = 0;
  let token = tokens[0];
  return ends.map(end => {
    while (token && token.end <= start) {
      token = tokens[++tokenIndex];
    }
    const covering = diagnostics.filter(d => d.start <= start && d.end >= end);
    const segment = {
      start,
      end,
      type: token && token.start <= start ? token.type : undefined,
      severity: covering.some(d => d.severity === 'error')
        ? 'error'
        : covering[0]?.severity,
    };
    start = end;
    return segment;
  });
}

function DiagnosticIcon({severity}: {severity: FingerprintDiagnostic['severity']}) {
  return severity === 'error' ? (
    <IconNot size="xs" variant="danger" />
  ) : (
    <IconWarning size="xs" variant="warning" />
  );
}

function DiagnosticRow({
  as,
  diagnostic,
  text,
  onSelect,
}: {
  diagnostic: FingerprintDiagnostic;
  onSelect: (diagnostic: FingerprintDiagnostic) => void;
  text: string;
  as?: 'li';
}) {
  return (
    <Flex as={as} gap="sm" align="center">
      <DiagnosticIcon severity={diagnostic.severity} />
      <Text size="sm">
        <Button variant="link" size="zero" onClick={() => onSelect(diagnostic)}>
          {t('Line %s', getLineNumber(text, diagnostic.start))}
        </Button>{' '}
        {DIAGNOSTIC_MESSAGES[diagnostic.code](
          text.slice(diagnostic.start, diagnostic.end)
        )}
      </Text>
    </Flex>
  );
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
 * would stop the rules from saving, or make them behave differently than they read. A
 * collapsed summary below the field explains each one.
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

  const text = normalizeNewlines(value);
  const {tokens, diagnostics} = tokenize(text);

  // Hold diagnostics back while typing, so a half-written rule isn't flagged. The summary
  // keeps showing the last settled ones so the layout doesn't jump.
  const [settledText] = useDebouncedValue(text, {wait: 500});
  const isSettled = settledText === text;
  const settledDiagnostics = isSettled ? diagnostics : tokenize(settledText).diagnostics;
  const [firstDiagnostic, ...otherDiagnostics] = settledDiagnostics;
  const errorCount = settledDiagnostics.filter(d => d.severity === 'error').length;
  const warningCount = settledDiagnostics.length - errorCount;

  const selectDiagnostic = ({start, end}: FingerprintDiagnostic) => {
    textAreaRef.current?.focus();
    textAreaRef.current?.setSelectionRange(start, end);
  };

  return (
    <Stack gap="xs" width="100%">
      <Container position="relative">
        <EditorTextArea
          {...props}
          ref={mergedRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={e => {
            if (layerRef.current) {
              layerRef.current.scrollTop = e.currentTarget.scrollTop;
              layerRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
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
          {getSegments(text, tokens, isSettled ? diagnostics : []).map(
            ({start, end, type, severity}) =>
              type || severity ? (
                <span key={start} data-token={type} data-severity={severity}>
                  {text.slice(start, end)}
                </span>
              ) : (
                text.slice(start, end)
              )
          )}
          {/* Gives a trailing newline a line to occupy, like the textarea does */}
          {text.endsWith('\n') && ' '}
        </HighlightLayer>
      </Container>
      {/* Hidden rather than removed when there's nothing to show, so the page doesn't jump */}
      <Container
        id={summaryId}
        visibility={settledDiagnostics.length > 0 ? 'visible' : 'hidden'}
      >
        {firstDiagnostic && otherDiagnostics.length === 0 ? (
          <DiagnosticRow
            diagnostic={firstDiagnostic}
            text={settledText}
            onSelect={selectDiagnostic}
          />
        ) : (
          <Disclosure size="xs">
            <Disclosure.Title>
              <Flex gap="xs" align="center">
                <DiagnosticIcon severity={errorCount > 0 ? 'error' : 'warning'} />
                <Text size="sm" bold={false}>
                  {[
                    errorCount > 0 && tn('%s error', '%s errors', errorCount),
                    warningCount > 0 && tn('%s warning', '%s warnings', warningCount),
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              </Flex>
            </Disclosure.Title>
            <Disclosure.Content>
              <Stack as="ul" gap="xs" padding="0" margin="0">
                {settledDiagnostics.map(diagnostic => (
                  <DiagnosticRow
                    key={`${diagnostic.code}-${diagnostic.start}`}
                    as="li"
                    diagnostic={diagnostic}
                    text={settledText}
                    onSelect={selectDiagnostic}
                  />
                ))}
              </Stack>
            </Disclosure.Content>
          </Disclosure>
        )}
      </Container>
    </Stack>
  );
}

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

  [data-token='comment'] {
    color: ${p => p.theme.tokens.syntax.comment};
  }
  [data-token='negation'] {
    color: ${p => p.theme.tokens.syntax.keyWord};
  }
  [data-token='matcher'],
  [data-token='attribute'] {
    color: ${p => p.theme.tokens.syntax.property};
  }
  [data-token='pattern'],
  [data-token='string'] {
    color: ${p => p.theme.tokens.syntax.selector};
  }
  [data-token='punctuation'] {
    color: ${p => p.theme.tokens.content.secondary};
  }
  [data-token='arrow'] {
    color: ${p => p.theme.tokens.content.promotion};
  }
  [data-token='variable'] {
    color: ${p => p.theme.tokens.content.warning};
  }
  [data-severity] {
    text-decoration-line: underline;
    text-decoration-style: wavy;
    text-decoration-skip-ink: none;
    text-underline-offset: 0.2em;
  }
  [data-severity='error'] {
    text-decoration-color: ${p => p.theme.tokens.graphics.danger.vibrant};
  }
  [data-severity='warning'] {
    text-decoration-color: ${p => p.theme.tokens.graphics.warning.vibrant};
  }
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
