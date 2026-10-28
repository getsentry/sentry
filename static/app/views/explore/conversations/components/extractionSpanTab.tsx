import {useState} from 'react';

import {t} from 'sentry/locale';
import {
  getRawSections,
  PrettyRawToggle,
  Sections,
  type SectionProps,
} from 'sentry/views/explore/conversations/components/evaluationSpanTab';
import {EmptySpanTab} from 'sentry/views/explore/conversations/components/spanTabContent';
import {
  ExtractionResults,
  ExtractionSource,
} from 'sentry/views/insights/pages/agents/components/extractionContent';
import {
  getExtractionRows,
  type Extraction,
} from 'sentry/views/insights/pages/agents/utils/extraction';

/**
 * The source text with each found value highlighted, followed by each field
 * with its extracted value. Hovering a value or a field emphasizes its
 * counterpart. When a recorded message isn't in the extraction format, both
 * messages are shown as recorded instead.
 */
export function ExtractionTab({extraction}: {extraction: Extraction}) {
  const [showRaw, setShowRaw] = useState(false);
  const [hoveredKeys, setHoveredKeys] = useState<string[] | null>(null);
  const {input, answers, rawInput, rawOutput} = extraction;

  if (!rawInput && !rawOutput) {
    return <EmptySpanTab message={t('No extraction for this span')} />;
  }

  const isInputUnreadable = Boolean(rawInput) && !input;
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
      title: t('Source'),
      children: (
        <ExtractionSource
          source={input.source}
          answers={answers}
          activeKeys={hoveredKeys}
          onHoverKeys={setHoveredKeys}
        />
      ),
    });
  }
  const rows = getExtractionRows(input?.fields, answers);
  if (rows.length > 0) {
    sections.push({
      title: t('Results'),
      children: (
        <ExtractionResults
          rows={rows}
          activeKeys={hoveredKeys}
          onHoverKeys={setHoveredKeys}
        />
      ),
    });
  }

  return <Sections sections={sections} toggle={toggle} />;
}
