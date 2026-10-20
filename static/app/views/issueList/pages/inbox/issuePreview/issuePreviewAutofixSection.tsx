import type {
  AutofixSection,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';

import {IssuePreviewAutofixPlanSection} from './issuePreviewAutofixPlanSection';
import {IssuePreviewAutofixProposalSection} from './issuePreviewAutofixProposalSection';
import {IssuePreviewAutofixRootCauseSection} from './issuePreviewAutofixRootCauseSection';

interface Props {
  autofix: ReturnType<typeof useExplorerAutofix>;
  groupId: string;
  section: AutofixSection;
  readOnly?: boolean;
}

export function IssuePreviewAutofixSection(props: Props) {
  switch (props.section.step) {
    case 'root_cause':
      return <IssuePreviewAutofixRootCauseSection {...props} />;
    case 'solution':
      return <IssuePreviewAutofixPlanSection {...props} />;
    case 'code_changes':
      return <IssuePreviewAutofixProposalSection {...props} />;
    default:
      return null;
  }
}
