import {useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {
  EvaluatedText,
  EvaluationAnswers,
  EvaluationQuestions,
} from 'sentry/views/insights/pages/agents/components/evaluationContent';
import type {
  EvaluationAnswer,
  EvaluationInput,
  EvaluationQuestionEntry,
} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';

interface EvaluationInputTabProps {
  /** Null when the message isn't in the evaluation format. */
  input: EvaluationInput | null;
  /** The unparsed `gen_ai.input.messages` value, shown in the raw view. */
  raw: string;
}

export function EvaluationInputTab({input, raw}: EvaluationInputTabProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (!input) {
    return <RawMessage raw={raw} />;
  }

  const toggle = <PrettyRawToggle showRaw={showRaw} onChange={setShowRaw} />;
  if (showRaw) {
    return <RawMessage raw={raw} toggle={toggle} />;
  }

  return (
    <Stack gap="lg">
      <Section title={t('Evaluated Text')} action={toggle}>
        <EvaluatedText state={input.state} />
      </Section>
      <QuestionsSection input={input} />
    </Stack>
  );
}

function QuestionsSection({input}: {input: EvaluationInput}) {
  if (input.invalidQuestions) {
    return (
      <Section
        title={t('Questions')}
        action={<Tag variant="muted">{t('Unrecognized')}</Tag>}
      >
        <TraceDrawerComponents.MultilineJSON
          value={input.invalidQuestions.value}
          mode="pretty"
        />
      </Section>
    );
  }
  if (input.questions.length === 0) {
    return null;
  }
  return (
    <Section title={t('Questions')}>
      <EvaluationQuestions questions={input.questions} />
    </Section>
  );
}

interface EvaluationOutputTabProps {
  /** Null when the message isn't in the evaluation format. */
  answers: EvaluationAnswer[] | null;
  /** The unparsed `gen_ai.output.messages` value, shown in the raw view. */
  raw: string;
  questions?: EvaluationQuestionEntry[];
}

export function EvaluationOutputTab({answers, raw, questions}: EvaluationOutputTabProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (!answers) {
    return <RawMessage raw={raw} />;
  }

  const toggle = <PrettyRawToggle showRaw={showRaw} onChange={setShowRaw} />;
  if (showRaw) {
    return <RawMessage raw={raw} toggle={toggle} />;
  }

  return (
    <Section title={t('Answers')} action={toggle}>
      <EvaluationAnswers answers={answers} questions={questions} />
    </Section>
  );
}

function Section({
  title,
  action,
  children,
}: {
  children: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack gap="md">
      <Flex align="center" justify="between" gap="md">
        <Text bold>{title}</Text>
        {action}
      </Flex>
      {children}
    </Stack>
  );
}

function PrettyRawToggle({
  showRaw,
  onChange,
}: {
  onChange: (showRaw: boolean) => void;
  showRaw: boolean;
}) {
  return (
    <SegmentedControl
      aria-label={t('Message format')}
      size="xs"
      value={showRaw ? 'raw' : 'formatted'}
      onChange={value => onChange(value === 'raw')}
    >
      <SegmentedControl.Item key="formatted">{t('Pretty')}</SegmentedControl.Item>
      <SegmentedControl.Item key="raw">{t('Raw')}</SegmentedControl.Item>
    </SegmentedControl>
  );
}

/**
 * The message as recorded. Without a toggle when there's no pretty view, i.e.
 * the message isn't in the evaluation format. That case is reported to Sentry
 * by `useInvalidEvaluationDetection` rather than flagged here, since users
 * can't fix it.
 */
function RawMessage({raw, toggle}: {raw: string; toggle?: React.ReactNode}) {
  return (
    <Section title={t('Raw Message')} action={toggle}>
      {isJson(raw) ? (
        <TraceDrawerComponents.MultilineJSON value={raw} mode="raw" />
      ) : (
        <TraceDrawerComponents.MultilineText mode="raw" clip={false}>
          {raw}
        </TraceDrawerComponents.MultilineText>
      )}
    </Section>
  );
}

function isJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
