import styled from '@emotion/styled';
import {IconImage} from '@sentry/icons/image';
import round from 'lodash/round';

import {Badge, Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import type {TagVariant} from '@sentry/scraps/theme';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {
  findQuestion,
  getAnswerLabel,
  getEvaluationResults,
  getScoreName,
  type EvaluatedContentPart,
  type EvaluatedMessage,
  type EvaluationAnswer,
  type EvaluationQuestion,
  type EvaluationQuestionEntry,
  type EvaluationResult,
} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';

// Building blocks for rendering `gen_ai.evaluate` spans. They carry no headings
// or view toggles, so each surface (span detail, conversation transcript) can
// frame them as it needs. Nested text and JSON boxes also skip their own
// Pretty/Raw toggle, since surfaces offer a raw view of the whole message.

/**
 * The content that was evaluated, as a message list. Text parts render as
 * formatted text, image parts as a placeholder, and raw parts as JSON. A single
 * message renders without its role; multiple messages are each labelled. Long
 * content is clipped behind "Show More" by default so it doesn't push the
 * questions and answers out of view.
 */
export function EvaluatedContent({
  state,
  clip = true,
}: {
  state: EvaluatedMessage[];
  clip?: boolean;
}) {
  const [firstMessage] = state;
  if (firstMessage && state.length === 1) {
    return <MessageParts parts={firstMessage.parts} clip={clip} />;
  }
  return (
    <Stack gap="md">
      {state.map((message, index) => (
        <Stack key={index} gap="xs">
          {message.role ? (
            <Text size="sm" variant="muted">
              {message.role}
            </Text>
          ) : null}
          <MessageParts parts={message.parts} clip={clip} />
        </Stack>
      ))}
    </Stack>
  );
}

function MessageParts({parts, clip}: {clip: boolean; parts: EvaluatedContentPart[]}) {
  return (
    <MessagePartsStack gap="sm">
      {parts.map((part, index) => {
        if (part.kind === 'text') {
          return (
            <TraceDrawerComponents.MultilineText key={index} mode="pretty" clip={clip}>
              {part.text}
            </TraceDrawerComponents.MultilineText>
          );
        }
        if (part.kind === 'image') {
          return <ImagePlaceholder key={index} />;
        }
        return (
          <TraceDrawerComponents.MultilineJSON
            key={index}
            value={part.value}
            clip={clip}
            mode="pretty"
          />
        );
      })}
    </MessagePartsStack>
  );
}

// TODO(aknaus): Drop MultilineText's own bottom margin so the parts can be
// spaced by the Stack gap alone, and remove this override.
const MessagePartsStack = styled(Stack)`
  && > * {
    margin-bottom: 0;
  }
`;

/**
 * Stands in for an image part; the image itself is never rendered.
 */
function ImagePlaceholder() {
  return (
    <Flex align="center" gap="sm" background="secondary" radius="md" padding="md">
      <IconImage size="sm" variant="muted" />
      <Text size="sm" variant="muted">
        {t('Image')}
      </Text>
    </Flex>
  );
}

/**
 * One card per question, paired with its answer: the question's type and
 * instructions, the answer, and the allowed answers with their probabilities.
 * Either side may be missing, e.g. when the output couldn't be read, and an
 * unrecognized side is shown as its raw value.
 */
export function EvaluationResults({
  questions = [],
  answers = [],
}: {
  answers?: EvaluationAnswer[];
  questions?: EvaluationQuestionEntry[];
}) {
  return (
    <Stack gap="md">
      {getEvaluationResults(questions, answers).map(result => (
        <ResultCard key={result.key} result={result} />
      ))}
    </Stack>
  );
}

function ResultCard({result}: {result: EvaluationResult}) {
  const {key, question, answer} = result;
  const validQuestion = question?.kind === 'question' ? question : undefined;
  const type = question?.kind === 'invalid' ? t('Unrecognized') : getResultType(result);
  const confidence = getConfidence(answer);
  return (
    <Container border="primary" radius="md" padding="md lg">
      <Stack gap="sm">
        <Flex align="baseline" justify="between" gap="md">
          <Flex flex="0 1 auto" minWidth="0" align="baseline" gap="sm">
            <Container flex="0 1 auto" minWidth="0">
              <InfoText title={key} mode="overflowOnly" bold>
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
          </Flex>
          <Flex flex="0 1 auto" minWidth="0" justify="end" align="center" gap="sm">
            {answer ? (
              <AnswerSummary answer={answer} question={validQuestion} />
            ) : (
              <Text size="sm" variant="muted">
                {t('No answer')}
              </Text>
            )}
            {confidence === undefined ? null : <ConfidenceBadge value={confidence} />}
          </Flex>
        </Flex>
        {validQuestion?.instructions ? (
          <Text size="sm" variant="muted">
            {validQuestion.instructions}
          </Text>
        ) : null}
        {question?.kind === 'invalid' ? <RawValue value={question.value} /> : null}
        {answer?.kind === 'invalid' ? (
          <RawValue value={answer.value} />
        ) : (
          <AnswerOptions answer={answer} question={validQuestion} />
        )}
      </Stack>
    </Container>
  );
}

export function ConfidenceBadge({
  value,
  title = t('Confidence'),
}: {
  value: number;
  title?: React.ReactNode;
}) {
  return (
    <Container flexShrink={0}>
      <Tooltip title={title} skipWrapper>
        <Badge variant="muted">{formatPercentage(value, 0)}</Badge>
      </Tooltip>
    </Container>
  );
}

function getConfidence(answer: EvaluationAnswer | undefined): number | undefined {
  switch (answer?.kind) {
    case 'boolean':
      return Math.max(answer.probability, 1 - answer.probability);
    case 'score':
    case 'choice':
      return answer.confidence;
    default:
      return undefined;
  }
}

/**
 * The question's type as sent, or else the kind of its answer.
 */
function getResultType({question, answer}: EvaluationResult): string | undefined {
  if (question?.kind === 'question') {
    return question.type;
  }
  switch (answer?.kind) {
    case 'boolean':
    case 'score':
    case 'choice':
      return answer.kind;
    default:
      return undefined;
  }
}

/**
 * One tag per answer, e.g. "authIssue: Yes", for compact summaries.
 */
export function EvaluationResultSummary({
  answers,
  questions,
}: {
  answers: EvaluationAnswer[];
  questions?: EvaluationQuestionEntry[];
}) {
  return (
    <Flex wrap="wrap" gap="xs">
      {answers.map(answer => {
        const label = getAnswerLabel(answer, findQuestion(questions, answer.key));
        if (label === null) {
          return null;
        }
        return (
          <TruncatedTag
            key={answer.key}
            variant={answer.kind === 'refusal' ? 'warning' : 'muted'}
          >
            {`${answer.key}: ${label}`}
          </TruncatedTag>
        );
      })}
    </Flex>
  );
}

/**
 * Marks a question or answer that doesn't match the expected shape and is shown
 * as its raw value.
 */
export function UnrecognizedTag() {
  return <Tag variant="muted">{t('Unrecognized')}</Tag>;
}

export function TruncatedTag({
  children,
  variant = 'muted',
}: {
  children: string;
  variant?: TagVariant;
}) {
  return (
    <Tooltip title={children} showOnlyOnOverflow skipWrapper>
      <Tag variant={variant}>{children}</Tag>
    </Tooltip>
  );
}

export function RawValue({value}: {value: unknown}) {
  return <TraceDrawerComponents.MultilineJSON value={value} mode="pretty" />;
}

function AnswerSummary({
  answer,
  question,
}: {
  answer: EvaluationAnswer;
  question?: EvaluationQuestion;
}) {
  switch (answer.kind) {
    case 'boolean': {
      return <AnswerHeadline label={answer.probability >= 0.5 ? t('Yes') : t('No')} />;
    }
    case 'score': {
      const score = String(round(answer.score, 2));
      const name = getScoreName(answer, answer.score, question);
      return <AnswerHeadline label={name ?? score} detail={name ? score : undefined} />;
    }
    case 'choice':
      return <AnswerHeadline label={answer.choice} />;
    case 'refusal':
      return (
        <Tooltip title={t('The model declined to answer.')}>
          <Tag variant="warning">{t('Refused')}</Tag>
        </Tooltip>
      );
    case 'invalid':
      return <UnrecognizedTag />;
    default:
      return null;
  }
}

function AnswerHeadline({label, detail}: {label: string; detail?: string}) {
  return (
    <Flex align="baseline" justify="end" gap="xs" minWidth="0">
      <Container flex="0 1 auto" minWidth="0">
        <InfoText title={label} mode="overflowOnly" bold>
          {label}
        </InfoText>
      </Container>
      {detail ? (
        <Container flexShrink={0}>
          <Text size="sm" variant="muted">
            {detail}
          </Text>
        </Container>
      ) : null}
    </Flex>
  );
}

interface AnswerOption {
  label: string;
  /** Matches a score value or choice, e.g. "2" or "billing". */
  value: string;
  description?: string;
}

/**
 * The allowed answers. Score questions list their scale, where the index is
 * the score value (`["low", "medium", "high"]`); choice questions describe each
 * option (`{"billing": "Charges and refunds"}`).
 */
function getQuestionOptions(question: EvaluationQuestion): AnswerOption[] {
  const {criteria, descriptions} = question;
  if (Array.isArray(criteria)) {
    const isScore = question.type === 'score';
    return criteria.map((label, index) => ({
      value: isScore ? String(index) : label,
      label: isScore ? `${index} · ${label}` : label,
      description: descriptions?.[index],
    }));
  }
  return Object.entries(criteria ?? {}).map(([value, description]) => ({
    value,
    label: value,
    description,
  }));
}

/**
 * The allowed answers with the probability of each, when the answer reports
 * them, or else as tags with the chosen one highlighted.
 */
function AnswerOptions({
  answer,
  question,
}: {
  answer?: EvaluationAnswer;
  question?: EvaluationQuestion;
}) {
  const options = question ? getQuestionOptions(question) : [];

  if (answer?.kind === 'score' || answer?.kind === 'choice') {
    const selected =
      answer.kind === 'score' ? String(Math.round(answer.score)) : answer.choice;
    const probabilities = Object.entries(answer.probabilities ?? {});
    if (probabilities.length === 0) {
      return <OptionTags options={options} selected={selected} />;
    }
    const entries = probabilities.map(([value, probability]) => ({
      value,
      probability,
      label:
        answer.kind === 'score'
          ? formatScoreValue(value, getScoreName(answer, Number(value), question))
          : value,
      description: options.find(option => option.value === value)?.description,
    }));
    return (
      <ProbabilityList
        entries={
          answer.kind === 'score'
            ? // Ascending score values, e.g. 0, 1, 2.
              entries.sort((a, b) => Number(a.value) - Number(b.value))
            : // Most likely option first.
              entries.sort((a, b) => b.probability - a.probability)
        }
        selected={selected}
      />
    );
  }

  return <OptionTags options={options} />;
}

function formatScoreValue(value: string, name: string | undefined): string {
  return name ? `${value} · ${name}` : value;
}

function OptionTags({options, selected}: {options: AnswerOption[]; selected?: string}) {
  if (options.length === 0) {
    return null;
  }
  return (
    <Flex wrap="wrap" gap="xs">
      {options.map(option => (
        <Tooltip
          key={option.value}
          title={getOptionTitle(option)}
          showOnlyOnOverflow={!option.description}
          skipWrapper
        >
          <Tag variant={option.value === selected ? 'info' : 'muted'}>{option.label}</Tag>
        </Tooltip>
      ))}
    </Flex>
  );
}

/**
 * Tooltip content for an option: its label above its description, so a
 * truncated label can still be read, or else just the label.
 */
function getOptionTitle({label, description}: AnswerOption): React.ReactNode {
  if (!description) {
    return label;
  }
  return (
    <Stack gap="xs">
      <Text bold>{label}</Text>
      <Text>{description}</Text>
    </Stack>
  );
}

/**
 * One bar per option or score value, in the given order. Descriptions show in a
 * tooltip on the label.
 */
function ProbabilityList({
  entries,
  selected,
}: {
  entries: Array<AnswerOption & {probability: number}>;
  selected: string;
}) {
  return (
    <Container paddingTop="xs">
      <Grid columns="fit-content(50%) minmax(0, 1fr) 3em" gap="xs md" align="center">
        {entries.map(entry => {
          const {value, label, description, probability} = entry;
          const isSelected = value === selected;
          return [
            <InfoText
              key={`${value}:label`}
              title={getOptionTitle(entry)}
              mode={description ? undefined : 'overflowOnly'}
              size="sm"
              variant={isSelected ? 'primary' : 'muted'}
              bold={isSelected}
              ellipsis
            >
              {label}
            </InfoText>,
            <BarTrack key={`${value}:bar`}>
              <BarFill
                isSelected={isSelected}
                style={{width: `${Math.min(Math.max(probability, 0), 1) * 100}%`}}
              />
            </BarTrack>,
            <Text key={`${value}:value`} size="sm" variant="muted" align="right">
              {formatPercentage(probability, 0)}
            </Text>,
          ];
        })}
      </Grid>
    </Container>
  );
}

const BarTrack = styled('div')`
  height: 4px;
  border-radius: ${p => p.theme.radius.full};
  background: ${p => p.theme.tokens.background.secondary};
  overflow: hidden;
`;

const BarFill = styled('div')<{isSelected: boolean}>`
  height: 100%;
  border-radius: ${p => p.theme.radius.full};
  background: ${p =>
    p.isSelected
      ? p.theme.tokens.graphics.accent.vibrant
      : p.theme.tokens.graphics.neutral.muted};
`;
