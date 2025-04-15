import {EvidencePreview} from 'sentry/components/groupPreviewTooltip/evidencePreview';
import {IssueCategory, type IssueType} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';

import {SpanEvidencePreview} from './spanEvidencePreview';
import {StackTracePreview} from './stackTracePreview';

type GroupPreviewTooltipProps = {
  children: React.ReactNode;
  groupId: string;
  groupingCurrentLevel?: number;
  issueCategory?: IssueCategory;
  issueType?: IssueType;
  project?: Project;
  projectId?: string;
  query?: string;
};

function GroupPreviewTooltip({
  children,
  groupId,
  groupingCurrentLevel,
  issueCategory,
  issueType,
  project,
  query,
}: GroupPreviewTooltipProps) {
  if (!issueCategory) {
    return null;
  }

  const issueTypeConfig = project
    ? getConfigForIssueType(
        {
          issueCategory,
          issueType,
        },
        project
      )
    : null;

  if (issueTypeConfig?.spanEvidence.enabled) {
    return (
      <SpanEvidencePreview groupId={groupId} query={query}>
        {children}
      </SpanEvidencePreview>
    );
  }

  if (issueCategory === IssueCategory.ERROR) {
    return (
      <StackTracePreview
        groupId={groupId}
        groupingCurrentLevel={groupingCurrentLevel}
        query={query}
      >
        {children}
      </StackTracePreview>
    );
  }

  return (
    <EvidencePreview groupId={groupId} query={query}>
      {children}
    </EvidencePreview>
  );
}

export default GroupPreviewTooltip;
