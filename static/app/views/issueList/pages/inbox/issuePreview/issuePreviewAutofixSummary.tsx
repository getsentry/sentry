import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {
  getOrderedAutofixSections,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';

import {IssuePreviewAutofixSection} from './issuePreviewAutofixSection';

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
  if (!runState) {
    return autofix.isWaitingForRun ? (
      <IssuePreviewAutofixSection
        autofix={autofix}
        groupId={groupId}
        readOnly={readOnly}
        section={{artifacts: [], blocks: [], status: 'processing', step: 'root_cause'}}
      />
    ) : null;
  }

  const orderedSections = getOrderedAutofixSections(runState);
  const sections = SECTION_ORDER.flatMap(step => {
    const section = orderedSections.find(item => item.step === step);
    return section && !excludeSteps?.has(step) ? [section] : [];
  });

  if (!sections.length) {
    return null;
  }

  return (
    <Dividers gap="md">
      {sections.map(section => (
        <IssuePreviewAutofixSection
          key={section.step}
          autofix={autofix}
          groupId={groupId}
          readOnly={readOnly}
          section={section}
        />
      ))}
    </Dividers>
  );
}

const Dividers = styled(Stack)`
  & > * + * {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
    padding-top: ${p => p.theme.space.md};
  }
`;
