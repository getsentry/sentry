import {Fragment} from 'react';
import styled from '@emotion/styled';
import round from 'lodash/round';

import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct} from 'sentry/locale';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {
  findQuestion,
  getAnswerLabel,
  getAnswerLabels,
  getScoreName,
  type EvaluationAnswer,
  type EvaluationQuestion,
  type EvaluationQuestionEntry,
} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';

// Building blocks for rendering `gen_ai.evaluate` spans. They carry no headings
// or view toggles, so each surface (span detail, conversation transcript) can
// frame them as it needs. Nested text and JSON boxes also skip their own
// Pretty/Raw toggle, since surfaces offer a raw view of the whole message.

/**
 * The text that was evaluated. Plain strings render as formatted text, anything
 * else as JSON. Long content is clipped behind "Show More" by default so it
 * doesn't push the questions and answers out of view.
 */
export function EvaluatedText({state, clip = true}: {state: unknown; clip?: boolean}) {
  if (typeof state === 'string') {
    return (
      <TraceDrawerComponents.MultilineText mode="pretty" clip={clip}>
        {state}
      </TraceDrawerComponents.MultilineText>
    );
  }
  return <TraceDrawerComponents.MultilineJSON value={state} clip={clip} mode="pretty" />;
}

/**
 * One card per question, with its instructions, type and allowed answers.
 */
export function EvaluationQuestions({questions}: {questions: EvaluationQuestionEntry[]}) {
  return (
    <Stack gap="md">
      {questions.map(question =>
        question.kind === 'invalid' ? (
          <Card key={question.key} title={question.key} trailing={<UnrecognizedTag />}>
            <RawValue value={question.value} />
          </Card>
        ) : (
          <Card
            key={question.key}
            title={question.key}
            description={question.instructions}
            trailing={<Tag variant="muted">{question.type}</Tag>}
          >
            <QuestionOptions question={question} />
          </Card>
        )
      )}
    </Stack>
  );
}

/**
 * One card per answer. Pass the questions to show what each answer responds to
 * and to name score values after the question's criteria.
 */
export function EvaluationAnswers({
  answers,
  questions,
}: {
  answers: EvaluationAnswer[];
  questions?: EvaluationQuestionEntry[];
}) {
  return (
    <Stack gap="md">
      {answers.map(answer => {
        const question = findQuestion(questions, answer.key);
        return (
          <Card
            key={answer.key}
            title={answer.key}
            description={question?.instructions}
            trailing={<AnswerSummary answer={answer} question={question} />}
          >
            <AnswerDetail answer={answer} question={question} />
          </Card>
        );
      })}
    </Stack>
  );
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
      {getAnswerLabels(answers, questions).map(([key, label]) => (
        <TruncatedTag key={key}>{`${key}: ${label}`}</TruncatedTag>
      ))}
    </Flex>
  );
}

/**
 * Marks a question or answer that doesn't match the expected shape and is shown
 * as its raw value.
 */
function UnrecognizedTag() {
  return <Tag variant="muted">{t('Unrecognized')}</Tag>;
}

/**
 * A tag that truncates long text, e.g. a sentence-long option, with the full
 * text in a tooltip.
 */
function TruncatedTag({children}: {children: string}) {
  return (
    <Tooltip title={children} showOnlyOnOverflow skipWrapper>
      <Tag variant="muted">{children}</Tag>
    </Tooltip>
  );
}

function RawValue({value}: {value: unknown}) {
  return <TraceDrawerComponents.MultilineJSON value={value} mode="pretty" />;
}

function Card({
  title,
  description,
  trailing,
  children,
}: {
  title: string;
  trailing: React.ReactNode;
  children?: React.ReactNode;
  description?: string;
}) {
  return (
    <Container border="primary" radius="md" padding="md lg">
      <Stack gap="sm">
        <Flex align="center" justify="between" gap="md">
          {/* Keys are usually short; cap them so a long one leaves room for
           * the answer. Both truncate with the full text in a tooltip. */}
          <Container flex="0 0 auto" maxWidth="50%">
            <InfoText title={title} mode="overflowOnly" bold>
              {title}
            </InfoText>
          </Container>
          <Flex flex="0 1 auto" minWidth="0" justify="end">
            {trailing}
          </Flex>
        </Flex>
        {description ? (
          <Text size="sm" variant="muted">
            {description}
          </Text>
        ) : null}
        {children}
      </Stack>
    </Container>
  );
}

function QuestionOptions({question}: {question: EvaluationQuestion}) {
  const {criteria} = question;

  // A scale, e.g. `["low", "medium", "high"]`, where the index is the value.
  if (Array.isArray(criteria)) {
    return criteria.length > 0 ? (
      <Flex wrap="wrap" gap="xs">
        {criteria.map((label, index) => (
          <TruncatedTag key={index}>
            {question.type === 'score' ? `${index} · ${label}` : label}
          </TruncatedTag>
        ))}
      </Flex>
    ) : null;
  }

  // Described options, e.g. `{"billing": "Charges and refunds"}`.
  const options = Object.entries(criteria ?? {});
  if (options.length === 0) {
    return null;
  }
  return (
    <Grid columns="fit-content(40%) minmax(0, 1fr)" gap="xs md" paddingTop="xs">
      {options.map(([label, description]) => [
        <Container key={`${label}:label`} minWidth="0">
          <TruncatedTag>{label}</TruncatedTag>
        </Container>,
        <Text key={`${label}:description`} size="sm" variant="muted">
          {description}
        </Text>,
      ])}
    </Grid>
  );
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
      const isYes = answer.probability >= 0.5;
      const confidence = isYes ? answer.probability : 1 - answer.probability;
      return (
        <Flex align="baseline" gap="xs">
          <Text bold>{getAnswerLabel(answer)}</Text>
          <Text size="sm" variant="muted">
            {formatPercentage(confidence, 0)}
          </Text>
        </Flex>
      );
    }
    case 'score': {
      // With a distribution, the named value is the highlighted row below, so
      // only the score is repeated here.
      if (hasDistribution(answer)) {
        return <Text bold>{round(answer.score, 2)}</Text>;
      }
      const name = getScoreName(answer, answer.score, question);
      return (
        <Flex align="baseline" gap="xs" minWidth="0">
          <InfoText title={name} mode="overflowOnly" bold>
            {name ?? round(answer.score, 2)}
          </InfoText>
          {name ? (
            <Text size="sm" variant="muted">
              {round(answer.score, 2)}
            </Text>
          ) : null}
        </Flex>
      );
    }
    case 'choice':
      // With a distribution, the choice is the highlighted row below.
      if (hasDistribution(answer)) {
        return null;
      }
      return (
        <InfoText title={answer.choice} mode="overflowOnly" bold>
          {answer.choice}
        </InfoText>
      );
    case 'invalid':
      return <UnrecognizedTag />;
    default:
      return null;
  }
}

function hasDistribution(answer: {probabilities?: Record<string, number>}): boolean {
  return Object.keys(answer.probabilities ?? {}).length > 0;
}

function AnswerDetail({
  answer,
  question,
}: {
  answer: EvaluationAnswer;
  question?: EvaluationQuestion;
}) {
  switch (answer.kind) {
    case 'score':
      return (
        <Fragment>
          <ProbabilityList
            // Ascending score values, e.g. 0, 1, 2.
            entries={Object.entries(answer.probabilities ?? {}).sort(
              ([a], [b]) => Number(a) - Number(b)
            )}
            selected={String(Math.round(answer.score))}
            getLabel={label => getScoreName(answer, Number(label), question) ?? label}
          />
          <Confidence value={answer.confidence} />
        </Fragment>
      );
    case 'choice':
      return (
        <Fragment>
          <ProbabilityList
            // Most likely option first.
            entries={Object.entries(answer.probabilities ?? {}).sort(
              ([, a], [, b]) => b - a
            )}
            selected={answer.choice}
          />
          <Confidence value={answer.confidence} />
        </Fragment>
      );
    case 'invalid':
      return <RawValue value={answer.value} />;
    default:
      return null;
  }
}

function Confidence({value}: {value?: number}) {
  if (value === undefined) {
    return null;
  }
  return (
    <Text size="sm" variant="muted">
      {tct('Confidence: [value]', {value: formatPercentage(value, 0)})}
    </Text>
  );
}

/**
 * One bar per option or score value, in the given order.
 */
function ProbabilityList({
  entries,
  selected,
  getLabel = label => label,
}: {
  /** `[label, probability]` pairs. */
  entries: Array<[string, number]>;
  selected: string;
  getLabel?: (label: string) => string;
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <Container paddingTop="xs">
      {/* Labels take at most half the width, so long option names don't
       * squeeze the bars; they truncate with the full text in a tooltip. */}
      <Grid columns="fit-content(50%) minmax(0, 1fr) 3em" gap="xs md" align="center">
        {entries.map(([label, probability]) => {
          const isSelected = label === selected;
          return [
            <InfoText
              key={`${label}:label`}
              title={getLabel(label)}
              mode="overflowOnly"
              size="sm"
              variant={isSelected ? 'primary' : 'muted'}
              bold={isSelected}
            >
              {getLabel(label)}
            </InfoText>,
            <BarTrack key={`${label}:bar`}>
              <BarFill
                isSelected={isSelected}
                style={{width: `${Math.min(Math.max(probability, 0), 1) * 100}%`}}
              />
            </BarTrack>,
            <Text key={`${label}:value`} size="sm" variant="muted" align="right">
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
