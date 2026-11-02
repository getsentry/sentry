import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct} from 'sentry/locale';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {
  ConfidenceBadge,
  RawValue,
  TruncatedTag,
  UnrecognizedTag,
} from 'sentry/views/insights/pages/agents/components/evaluationContent';
import {
  formatExtractedValue,
  getExtractedValueLabels,
  getSourceSegments,
  hasValue,
  isInferredAnswer,
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
 * One card per field, pairing what was asked for with what was extracted: the
 * field's type and instructions, the value and its confidence. Hovering a card
 * reports its key so the source can emphasize where the value was found.
 */
export function ExtractionResults({
  rows,
  activeKeys,
  onHoverKeys,
}: HoverLinkProps & {rows: ExtractionRow[]}) {
  return (
    <Stack gap="md">
      {rows.map(row => (
        <ResultCard
          key={row.key}
          row={row}
          isActive={activeKeys?.includes(row.key) ?? false}
          onHoverKeys={onHoverKeys}
        />
      ))}
    </Stack>
  );
}

function ResultCard({
  row,
  isActive,
  onHoverKeys,
}: {
  isActive: boolean;
  row: ExtractionRow;
  onHoverKeys?: (keys: string[] | null) => void;
}) {
  const {key, field, answer} = row;
  const validField = field?.kind === 'field' ? field : undefined;
  const type = getResultType(row);
  const isFound = answer?.kind === 'answer' && hasValue(answer);
  const isLinked = isFound && answer.offsets.length > 0;

  return (
    <ResultCardContainer
      border="primary"
      radius="md"
      padding="md lg"
      data-active={(isLinked && isActive) || undefined}
      onMouseEnter={isLinked ? () => onHoverKeys?.([key]) : undefined}
      onMouseLeave={isLinked ? () => onHoverKeys?.(null) : undefined}
    >
      <Stack gap="sm">
        <Flex align="baseline" justify="between" gap="md">
          <Flex flex="0 1 auto" minWidth="0" align="baseline" gap="sm">
            <Container flex="0 1 auto" minWidth="0">
              <InfoText
                title={key}
                mode="overflowOnly"
                bold
                variant={isFound ? undefined : 'muted'}
              >
                {key}
              </InfoText>
            </Container>
            {type ? (
              <Container flex="0 1 auto" minWidth="0">
                <InfoText title={type} mode="overflowOnly" size="sm" variant="muted">
                  {type}
                </InfoText>
              </Container>
            ) : null}
            {isInferredAnswer(answer) ? <InferredTag /> : null}
          </Flex>
          <Flex flex="0 1 auto" minWidth="0" justify="end" align="center" gap="sm">
            <AnswerValue answer={answer} />
            <AnswerConfidence answer={answer} />
          </Flex>
        </Flex>
        {validField?.instructions ? (
          <Text size="sm" variant="muted">
            {validField.instructions}
          </Text>
        ) : null}
        <SourceWording answer={answer} />
        {field?.kind === 'invalid' ? <RawValue value={field.value} /> : null}
        {answer?.kind === 'invalid' ? <RawValue value={answer.value} /> : null}
      </Stack>
    </ResultCardContainer>
  );
}

/**
 * The field's type as requested, or else the type of its answer.
 */
function getResultType({field, answer}: ExtractionRow): string | undefined {
  if (field?.kind === 'invalid') {
    return t('Unrecognized');
  }
  if (field?.kind === 'field') {
    return field.type;
  }
  return answer?.kind === 'answer' ? answer.type : undefined;
}

const ResultCardContainer = styled(Container)`
  &&[data-active] {
    background: ${p => p.theme.tokens.background.transparent.accent.muted};
    border-color: ${p => p.theme.tokens.border.accent.moderate};
  }
`;

function InferredTag() {
  return (
    <Tooltip
      title={t('Not taken word for word from the source. The model derived it.')}
      skipWrapper
    >
      <Tag variant="muted">{t('Inferred')}</Tag>
    </Tooltip>
  );
}

function NotInSource({nullProbability}: {nullProbability: number | undefined}) {
  if (nullProbability === undefined) {
    return (
      <Text size="sm" variant="muted">
        {t('Not in source')}
      </Text>
    );
  }
  return (
    <InfoText
      title={t(
        "%s confidence reported by the model that the source doesn't contain this field",
        formatPercentage(nullProbability, 0)
      )}
      size="sm"
      variant="muted"
    >
      {t('Not in source')}
    </InfoText>
  );
}

/**
 * The extracted value, with list items as tags that wrap within the value's
 * side of the card.
 */
function AnswerValue({answer}: {answer: ExtractionAnswer | undefined}) {
  if (!answer) {
    return (
      <Text size="sm" variant="muted">
        {t('No answer')}
      </Text>
    );
  }
  if (answer.kind === 'invalid') {
    return <UnrecognizedTag />;
  }
  if (!hasValue(answer)) {
    return <NotInSource nullProbability={answer.nullProbability} />;
  }
  if (Array.isArray(answer.value)) {
    return (
      <Flex wrap="wrap" justify="end" gap="xs" minWidth="0">
        {answer.value.map((item, index) => (
          <TruncatedTag key={index}>{formatExtractedValue(item)}</TruncatedTag>
        ))}
      </Flex>
    );
  }
  const label = formatExtractedValue(answer.value);
  return (
    <Container flex="0 1 auto" minWidth="0">
      <InfoText title={label} mode="overflowOnly" bold>
        {label}
      </InfoText>
    </Container>
  );
}

/**
 * The confidence the model reported for a found value.
 */
function AnswerConfidence({answer}: {answer: ExtractionAnswer | undefined}) {
  if (answer?.kind !== 'answer' || !hasValue(answer) || answer.confidence === undefined) {
    return null;
  }
  return (
    <ConfidenceBadge
      value={answer.confidence}
      title={t('Confidence reported by the model')}
    />
  );
}

/**
 * The source wording when it adds something: the original text of a normalized
 * value (e.g. "net 30" for a due date), or the candidate the model rejected for
 * a field it didn't find.
 */
function SourceWording({answer}: {answer: ExtractionAnswer | undefined}) {
  if (answer?.kind !== 'answer' || answer.guess === undefined || answer.guess === null) {
    return null;
  }
  const guess = formatExtractedValue(answer.guess);
  const isFound = hasValue(answer);
  if (isFound && guess === formatExtractedValue(answer.value)) {
    return null;
  }
  const guessText = (
    <Text size="sm" monospace>
      {guess}
    </Text>
  );
  return (
    <Text size="sm" variant="muted">
      {isFound
        ? tct('From source: [guess]', {guess: guessText})
        : tct('Rejected candidate: [guess]', {guess: guessText})}
    </Text>
  );
}

/**
 * One tag per extracted field, e.g. "invoice_number: INV-2291", for compact
 * summaries. Fields that weren't found are left out.
 */
export function ExtractionResultSummary({answers}: {answers: ExtractionAnswer[]}) {
  return (
    <Flex wrap="wrap" gap="xs">
      {getExtractedValueLabels(answers).map(([key, label]) => (
        <TruncatedTag key={key}>{`${key}: ${label}`}</TruncatedTag>
      ))}
    </Flex>
  );
}
