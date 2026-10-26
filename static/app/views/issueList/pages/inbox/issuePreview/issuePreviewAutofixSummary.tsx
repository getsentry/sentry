import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {
  getOrderedAutofixSections,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';

import {IssuePreviewAutofixSection} from './issuePreviewAutofixSection';
import {getAutofixSectionLabels} from './issuePreviewSection';

const SECTION_ORDER = ['code_changes', 'solution', 'root_cause'];

interface IssuePreviewAutofixSummaryProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  groupId: string;
  excludeSteps?: ReadonlySet<string>;
  readOnly?: boolean;
}

export function IssuePreviewAutofixSummary({
  autofix,
  groupId,
  excludeSteps,
  readOnly = false,
}: IssuePreviewAutofixSummaryProps) {
  const {runState} = autofix;
  let orderedSections = getOrderedAutofixSections(runState);
  if (!runState && autofix.isWaitingForRun) {
    orderedSections = [
      {artifacts: [], blocks: [], status: 'processing', step: 'root_cause'},
    ];
  }

  const sections = SECTION_ORDER.flatMap(step => {
    const section = orderedSections.find(item => item.step === step);
    return section && !excludeSteps?.has(step) ? [section] : [];
  });

  if (!sections.length) {
    return null;
  }

  return (
    <Stack gap="md">
      {sections.map(section => {
        const labels = getAutofixSectionLabels(section.step);
        return labels ? (
          <Stack key={section.step} border="primary" radius="md" padding="lg" gap="lg">
            <Heading as="h3" size="md">
              {labels.title}
            </Heading>
            <IssuePreviewAutofixSection
              autofix={autofix}
              groupId={groupId}
              readOnly={readOnly}
              section={section}
            />
          </Stack>
        ) : null;
      })}
    </Stack>
  );
}
