import type {
  AutofixSection,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';

import {IssuePreviewAutofixPlanSection} from './issuePreviewAutofixPlanSection';
import {IssuePreviewAutofixProposalSection} from './issuePreviewAutofixProposalSection';
import {IssuePreviewAutofixRootCauseSection} from './issuePreviewAutofixRootCauseSection';
import {RetryableAutofixSection} from './retryableAutofixSection';

interface Props {
  autofix: ReturnType<typeof useExplorerAutofix>;
  groupId: string;
  section: AutofixSection;
  readOnly?: boolean;
}

export function IssuePreviewAutofixSection({autofix, groupId, section, readOnly}: Props) {
  let content: React.ReactNode;

  switch (section.step) {
    case 'root_cause':
      content = (
        <IssuePreviewAutofixRootCauseSection groupId={groupId} section={section} />
      );
      break;
    case 'solution':
      content = <IssuePreviewAutofixPlanSection section={section} />;
      break;
    case 'code_changes':
      content = <IssuePreviewAutofixProposalSection section={section} />;
      break;
    default:
      return null;
  }

  return (
    <RetryableAutofixSection
      autofix={autofix}
      readOnly={readOnly}
      section={section}
      step={section.step}
    >
      {content}
    </RetryableAutofixSection>
  );
}
