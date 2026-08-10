import {useMemo} from 'react';
import styled from '@emotion/styled';

import {
  getOrderedAutofixSections,
  isCodeChangesSection,
  isRootCauseSection,
  isSolutionSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';

import {IssuePreviewAutofixPlanSection} from './issuePreviewAutofixPlanSection';
import {IssuePreviewAutofixProposalSection} from './issuePreviewAutofixProposalSection';
import {IssuePreviewAutofixRootCauseSection} from './issuePreviewAutofixRootCauseSection';

interface IssuePreviewAutofixSummaryProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  groupId: string;
}

export function IssuePreviewAutofixSummary({
  autofix,
  groupId,
}: IssuePreviewAutofixSummaryProps) {
  const {runState} = autofix;
  const sections = useMemo(() => getOrderedAutofixSections(runState), [runState]);

  const proposalSection = sections.findLast(isCodeChangesSection);
  const planSection = sections.findLast(isSolutionSection);
  const rootCauseSection = sections.findLast(isRootCauseSection);

  if (!runState) {
    return null;
  }

  const defaultExpandedSection = proposalSection
    ? 'proposal'
    : planSection
      ? 'plan'
      : 'rootCause';

  return (
    <Dividers>
      {proposalSection ? (
        <IssuePreviewAutofixProposalSection
          autofix={autofix}
          defaultExpanded={defaultExpandedSection === 'proposal'}
          section={proposalSection}
        />
      ) : null}

      {planSection ? (
        <IssuePreviewAutofixPlanSection
          autofix={autofix}
          defaultExpanded={defaultExpandedSection === 'plan'}
          section={planSection}
        />
      ) : null}

      {rootCauseSection ? (
        <IssuePreviewAutofixRootCauseSection
          autofix={autofix}
          defaultExpanded={defaultExpandedSection === 'rootCause'}
          groupId={groupId}
          section={rootCauseSection}
        />
      ) : null}
    </Dividers>
  );
}

const Dividers = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};

  & > * + * {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
    padding-top: ${p => p.theme.space.md};
  }
`;
