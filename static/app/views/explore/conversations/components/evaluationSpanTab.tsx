import {useState} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {EmptySpanTab} from 'sentry/views/explore/conversations/components/spanTabContent';
import {
  EvaluatedContent,
  EvaluationResults,
} from 'sentry/views/insights/pages/agents/components/evaluationContent';
import type {Evaluation} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';

interface SectionProps {
  children: React.ReactNode;
  title: string;
}

/**
 * The evaluated content followed by each question with its answer. When a
 * recorded message isn't in the evaluation format, both messages are shown as
 * recorded instead.
 */
export function EvaluationTab({evaluation}: {evaluation: Evaluation}) {
  const [showRaw, setShowRaw] = useState(false);
  const {input, answers, rawInput, rawOutput} = evaluation;

  if (!rawInput && !rawOutput) {
    return <EmptySpanTab message={t('No decision for this span')} />;
  }

  // Unreadable messages are reported to Sentry by
  // `useInvalidEvaluationDetection` rather than flagged here, since users can't
  // fix them.
  const isInputUnreadable = Boolean(rawInput) && (!input || input.invalidQuestions);
  const isOutputUnreadable = Boolean(rawOutput) && !answers;
  if (isInputUnreadable || isOutputUnreadable) {
    return <Sections sections={getRawSections(rawInput, rawOutput, false)} />;
  }

  const toggle = <PrettyRawToggle showRaw={showRaw} onChange={setShowRaw} />;
  if (showRaw) {
    return (
      <Sections sections={getRawSections(rawInput, rawOutput, true)} toggle={toggle} />
    );
  }

  const sections: SectionProps[] = [];
  if (input) {
    sections.push({
      title: t('Evaluated Content'),
      children: <EvaluatedContent state={input.state} />,
    });
  }
  if (input?.questions.length || answers?.length) {
    sections.push({
      title: t('Results'),
      children: (
        <EvaluationResults questions={input?.questions} answers={answers ?? undefined} />
      ),
    });
  }

  return <Sections sections={sections} toggle={toggle} />;
}

function getRawSections(
  rawInput: string | undefined,
  rawOutput: string | undefined,
  isRawText: boolean
): SectionProps[] {
  const sections: SectionProps[] = [];
  if (rawInput) {
    sections.push({
      title: t('Input'),
      children: <RecordedMessage raw={rawInput} isRawText={isRawText} />,
    });
  }
  if (rawOutput) {
    sections.push({
      title: t('Output'),
      children: <RecordedMessage raw={rawOutput} isRawText={isRawText} />,
    });
  }
  return sections;
}

/**
 * Stacks the sections, with the toggle on the first one.
 */
function Sections({
  sections,
  toggle,
}: {
  sections: SectionProps[];
  toggle?: React.ReactNode;
}) {
  return (
    <Stack gap="lg">
      {sections.map(({title, children}, index) => (
        <Stack key={title} gap="md">
          <Flex align="center" justify="between" gap="md">
            <Text bold>{title}</Text>
            {index === 0 ? toggle : null}
          </Flex>
          {children}
        </Stack>
      ))}
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
 * A message as recorded: formatted JSON, or its JSON text when `isRawText` is
 * set. Content that isn't JSON is shown as is.
 */
function RecordedMessage({raw, isRawText}: {isRawText: boolean; raw: string}) {
  return isJson(raw) ? (
    <TraceDrawerComponents.MultilineJSON
      value={raw}
      mode={isRawText ? 'raw' : undefined}
    />
  ) : (
    <TraceDrawerComponents.MultilineText mode="raw" clip={false}>
      {raw}
    </TraceDrawerComponents.MultilineText>
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
