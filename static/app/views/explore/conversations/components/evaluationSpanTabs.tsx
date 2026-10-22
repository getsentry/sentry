import {useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {
  EvaluatedContent,
  EvaluationAnswers,
  EvaluationQuestions,
} from 'sentry/views/insights/pages/agents/components/evaluationContent';
import {
  ExtractionFieldList,
  ExtractionSource,
} from 'sentry/views/insights/pages/agents/components/extractionContent';
import type {
  EvaluationAnswer,
  EvaluationInput,
  EvaluationQuestionEntry,
} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {
  getExtractionRows,
  type Extraction,
} from 'sentry/views/insights/pages/agents/utils/extraction';
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
      <Section title={t('Evaluated Content')} action={toggle}>
        <EvaluatedContent state={input.state} />
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

/**
 * Extraction spans in one view: the source text with each found value
 * highlighted, above one row per field pairing what was asked for with what was
 * extracted. Hovering a value or a row emphasizes its counterpart. Parts that
 * can't be read are shown raw in place.
 */
export function ExtractionTab({extraction}: {extraction: Extraction}) {
  const {input, answers, rawInput, rawOutput} = extraction;
  const [showRaw, setShowRaw] = useState(false);
  // The fields hovered in either the source or the field list, so the other
  // side can highlight them.
  const [hoveredKeys, setHoveredKeys] = useState<string[] | null>(null);

  const hasPrettyView = Boolean(input || answers);
  const toggle = hasPrettyView ? (
    <PrettyRawToggle showRaw={showRaw} onChange={setShowRaw} />
  ) : undefined;

  if (!hasPrettyView || showRaw) {
    return (
      <Stack gap="lg">
        {rawInput ? (
          <RawMessage raw={rawInput} title={t('Raw Input')} toggle={toggle} />
        ) : null}
        {rawOutput ? (
          <RawMessage
            raw={rawOutput}
            title={t('Raw Output')}
            toggle={rawInput ? undefined : toggle}
          />
        ) : null}
      </Stack>
    );
  }

  const rows = getExtractionRows(input?.fields, answers);
  const hasSourceSection = Boolean(input || rawInput);

  return (
    <Stack gap="lg">
      {input ? (
        <Section title={t('Source')} action={toggle}>
          <ExtractionSource
            source={input.source}
            answers={answers}
            activeKeys={hoveredKeys}
            onHoverKeys={setHoveredKeys}
          />
        </Section>
      ) : rawInput ? (
        <RawMessage raw={rawInput} title={t('Raw Input')} toggle={toggle} />
      ) : null}
      {rows.length > 0 ? (
        <Section title={t('Fields')} action={hasSourceSection ? undefined : toggle}>
          <ExtractionFieldList
            rows={rows}
            activeKeys={hoveredKeys}
            onHoverKeys={setHoveredKeys}
          />
        </Section>
      ) : null}
      {!answers && rawOutput ? (
        <RawMessage raw={rawOutput} title={t('Raw Output')} />
      ) : null}
    </Stack>
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
function RawMessage({
  raw,
  toggle,
  title = t('Raw Message'),
}: {
  raw: string;
  title?: string;
  toggle?: React.ReactNode;
}) {
  return (
    <Section title={title} action={toggle}>
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
