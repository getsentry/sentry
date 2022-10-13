import {Fragment, ReactChild} from 'react';

import ProjectsStore from 'sentry/stores/projectsStore';
import {IssueCategory} from 'sentry/types';

import {SpanEvidencePreview} from './spanEvidencePreview';
import {StackTracePreview} from './stackTracePreview';

type GroupPreviewTooltipProps = {
  children: ReactChild;
  groupId: string;
  issueCategory: IssueCategory;
  // we need eventId only when hovering over Event, not Group
  // (different API call is made to get the stack trace then)
  eventId?: string;
  groupingCurrentLevel?: number;
  projectId?: string;
};

const GroupPreviewTooltip = ({
  children,
  eventId,
  groupId,
  groupingCurrentLevel,
  issueCategory,
  projectId,
}: GroupPreviewTooltipProps) => {
  const projectSlug = eventId ? ProjectsStore.getById(projectId)?.slug : undefined;

  switch (issueCategory) {
    case IssueCategory.ERROR:
      return (
        <StackTracePreview
          issueId={groupId}
          groupingCurrentLevel={groupingCurrentLevel}
          eventId={eventId}
          projectSlug={projectSlug}
        >
          {children}
        </StackTracePreview>
      );
    case IssueCategory.PERFORMANCE:
      return (
        <SpanEvidencePreview
          groupId={groupId}
          eventId={eventId}
          projectSlug={projectSlug}
        >
          {children}
        </SpanEvidencePreview>
      );
    default:
      return <Fragment>{children}</Fragment>;
  }
};

export default GroupPreviewTooltip;
