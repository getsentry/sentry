import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct} from 'sentry/locale';
import {
  ProbabilityBar,
  TruncatedTag,
  UnrecognizedTag,
} from 'sentry/views/insights/pages/agents/components/evaluationContent';
import {
  formatExtractedValue,
  getExtractedValueLabel,
  getSourceSegments,
  isInferredAnswer,
  type ExtractedValue,
  type ExtractionAnswer,
  type ExtractionRow,
} from 'sentry/views/insights/pages/agents/utils/extraction';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';

// Building blocks for rendering `gen_ai.extract` spans. Like the evaluation
// blocks, they carry no headings or view toggles so each surface can frame them.

interface HoverLinkProps {
  /** Keys of the fields to emphasize, e.g. the ones hovered elsewhere. */
  activeKeys?: string[] | null;
  /** Reports the fields under the pointer, or null when it leaves. */
  onHoverKeys?: (keys: string[] | null) => void;
}

/**
 * The text the fields were extracted from, with each value found highlighted
 * in place. Hovering a highlight names the fields it was extracted for.
 */
export function ExtractionSource({
  source,
  answers,
  clip = true,
  activeKeys,
  onHoverKeys,
}: HoverLinkProps & {
  source: string;
  answers?: ExtractionAnswer[] | null;
  clip?: boolean;
}) {
  return (
    <TraceDrawerComponents.MultilineText
      mode="pretty"
      clip={clip}
      renderFormatted={text =>
        getSourceSegments(text, answers).map((segment, index) =>
          segment.keys ? (
            <Tooltip key={index} title={segment.keys.join(', ')} skipWrapper>
              <Highlight
                data-active={
                  segment.keys.some(key => activeKeys?.includes(key)) || undefined
                }
                onMouseEnter={() => onHoverKeys?.(segment.keys ?? null)}
                onMouseLeave={() => onHoverKeys?.(null)}
              >
                {segment.text}
              </Highlight>
            </Tooltip>
          ) : (
            <Fragment key={index}>{segment.text}</Fragment>
          )
        )
      }
    >
      {source}
    </TraceDrawerComponents.MultilineText>
  );
}

const Highlight = styled('mark')`
  color: inherit;
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
  border-radius: ${p => p.theme.radius.xs};
  padding: 0 ${p => p.theme.space['2xs']};
  /* Always bordered so emphasizing it doesn't shift the surrounding text. */
  border: 1px solid transparent;

  &[data-active] {
    border-color: ${p => p.theme.tokens.border.accent.vibrant};
  }
`;

/**
 * One row per field: what was asked for (type, instructions) next to what was
 * extracted (value, confidence, the source wording). Hovering a row reports its
 * key so the source can emphasize where the value was found.
 */
export function ExtractionFieldList({
  rows,
  activeKeys,
  onHoverKeys,
}: HoverLinkProps & {rows: ExtractionRow[]}) {
  return (
    <Container border="primary" radius="md" overflow="hidden">
      {rows.map((row, index) => (
        <Fragment key={row.key}>
          {index > 0 ? <Separator orientation="horizontal" border="primary" /> : null}
          <FieldRow
            row={row}
            isActive={activeKeys?.includes(row.key) ?? false}
            onHoverKeys={onHoverKeys}
          />
        </Fragment>
      ))}
    </Container>
  );
}

function FieldRow({
  row,
  isActive,
  onHoverKeys,
}: {
  isActive: boolean;
  row: ExtractionRow;
  onHoverKeys?: (keys: string[] | null) => void;
}) {
  const {key, field, answer} = row;
  const value = answer?.kind === 'answer' ? answer : undefined;
  const type = field?.kind === 'field' ? field.type : value?.type;
  const instructions = field?.kind === 'field' ? field.instructions : undefined;
  const isInvalid = field?.kind === 'invalid' || answer?.kind === 'invalid';

  return (
    <Container
      padding="md lg"
      background={isActive ? 'secondary' : undefined}
      data-active={isActive || undefined}
      onMouseEnter={() => onHoverKeys?.([key])}
      onMouseLeave={() => onHoverKeys?.(null)}
    >
      <Stack gap="xs">
        {/* The key is never truncated; the value wraps below it when there's no room. */}
        <Flex align="center" justify="between" gap="xs md" wrap="wrap">
          <Flex align="center" gap="sm" wrap="wrap">
            <Text bold wordBreak="break-word">
              {key}
            </Text>
            {type ? <Tag variant="muted">{type}</Tag> : null}
            {isInferredAnswer(answer) ? <InferredTag /> : null}
            {isInvalid ? <UnrecognizedTag /> : null}
          </Flex>
          {value ? (
            <Container minWidth="0" maxWidth="100%">
              <ValueSummary answer={value} />
            </Container>
          ) : null}
        </Flex>
        {instructions ? (
          <Text size="sm" variant="muted">
            {instructions}
          </Text>
        ) : null}
        {value ? <ValueDetail answer={value} /> : null}
        {value ? <ConfidenceBar answer={value} /> : null}
        {field?.kind === 'invalid' ? (
          <TraceDrawerComponents.MultilineJSON value={field.value} mode="pretty" />
        ) : null}
        {answer?.kind === 'invalid' ? (
          <TraceDrawerComponents.MultilineJSON value={answer.value} mode="pretty" />
        ) : null}
      </Stack>
    </Container>
  );
}

function InferredTag() {
  return (
    <Tooltip
      title={t(
        "This value doesn't appear in the source. The model worked it out from the text, so there's nothing to highlight."
      )}
      skipWrapper
    >
      <Tag variant="info">{t('Inferred')}</Tag>
    </Tooltip>
  );
}

function isMissing(answer: ExtractedValue): boolean {
  return answer.value === null || answer.value === undefined;
}

/**
 * The value, on the row's first line. Lists get a line of their own instead.
 */
function ValueSummary({answer}: {answer: ExtractedValue}) {
  if (isMissing(answer)) {
    return (
      <Text variant="muted" italic>
        {t('Not found')}
      </Text>
    );
  }
  if (Array.isArray(answer.value)) {
    return null;
  }
  return (
    <InfoText title={formatExtractedValue(answer.value)} mode="overflowOnly" bold>
      {formatExtractedValue(answer.value)}
    </InfoText>
  );
}

/**
 * How sure the model is of the value or, for a field it didn't find, that the
 * source doesn't contain it.
 */
function ConfidenceBar({answer}: {answer: ExtractedValue}) {
  const missing = isMissing(answer);
  const confidence = missing ? answer.nullProbability : answer.confidence;
  if (confidence === undefined) {
    return null;
  }
  return (
    <Container maxWidth="240px">
      <ProbabilityBar
        label={
          missing ? (
            <InfoText title={t("Confidence that the source doesn't contain this field")}>
              {t('Confidence')}
            </InfoText>
          ) : (
            t('Confidence')
          )
        }
        value={confidence}
        emphasized={!missing}
      />
    </Container>
  );
}

/**
 * List items, and the source wording when it adds something: the original text
 * of a normalized value (e.g. "net 30" for a due date), or the candidate the
 * model rejected for a field it didn't find.
 */
function ValueDetail({answer}: {answer: ExtractedValue}) {
  const missing = isMissing(answer);
  const guess =
    answer.guess === undefined || answer.guess === null
      ? undefined
      : formatExtractedValue(answer.guess);
  const showGuess =
    guess !== undefined && (missing || guess !== formatExtractedValue(answer.value));
  const guessText = (
    <Text size="sm" monospace>
      {guess}
    </Text>
  );

  return (
    <Fragment>
      {Array.isArray(answer.value) ? (
        <Flex wrap="wrap" gap="xs">
          {answer.value.map((item, index) => (
            <TruncatedTag key={index}>{formatExtractedValue(item)}</TruncatedTag>
          ))}
        </Flex>
      ) : null}
      {showGuess ? (
        <Text size="sm" variant="muted">
          {missing
            ? tct('Rejected candidate: [guess]', {guess: guessText})
            : tct('From source: [guess]', {guess: guessText})}
        </Text>
      ) : null}
    </Fragment>
  );
}

/**
 * One tag per extracted field, e.g. "invoice_number: INV-2291", for compact
 * summaries.
 */
export function ExtractionResultSummary({answers}: {answers: ExtractionAnswer[]}) {
  return (
    <Flex wrap="wrap" gap="xs">
      {answers.map(answer => {
        const label = getExtractedValueLabel(answer);
        if (label === null) {
          return null;
        }
        return <TruncatedTag key={answer.key}>{`${answer.key}: ${label}`}</TruncatedTag>;
      })}
    </Flex>
  );
}
