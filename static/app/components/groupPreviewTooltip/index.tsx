import {ReactChild} from 'react';

import {EvidencePreview} from 'sentry/components/groupPreviewTooltip/evidencePreview';
import {IssueCategory} from 'sentry/types';

import {SpanEvidencePreview} from './spanEvidencePreview';
import {StackTracePreview} from './stackTracePreview';

type GroupPreviewTooltipProps = {
  children: ReactChild;
  groupId: string;
  groupingCurrentLevel?: number;
  issueCategory?: IssueCategory;
  projectId?: string;
  query?: string;
};

function GroupPreviewTooltip({
  children,
  groupId,
  groupingCurrentLevel,
  issueCategory,
  query,
}: GroupPreviewTooltipProps) {
  if (!issueCategory) {
    return null;
  }

  switch (issueCategory) {
    case IssueCategory.ERROR:
      return (
        <StackTracePreview
          groupId={groupId}
          groupingCurrentLevel={groupingCurrentLevel}
          query={query}
        >
          {children}
        </StackTracePreview>
      );
    case IssueCategory.PERFORMANCE:
      return (
        <SpanEvidencePreview groupId={groupId} query={query}>
          {children}
        </SpanEvidencePreview>
      );
    default:
      return (
        <EvidencePreview groupId={groupId} query={query}>
          {children}
        </EvidencePreview>
      );
  }
}

export default GroupPreviewTooltip;
