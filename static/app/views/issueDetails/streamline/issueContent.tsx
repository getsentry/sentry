import {Fragment} from 'react';

import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {MergedIssuesDataSection} from 'sentry/views/issueDetails/groupMerged/mergedIssuesDataSection';
import {SimilarIssuesDataSection} from 'sentry/views/issueDetails/groupSimilarIssues/similarIssuesDataSection';

export interface IssueContentProps {
  group: Group;
  project: Project;
}

export function IssueContent({group, project}: IssueContentProps) {
  return (
    <Fragment>
      <MergedIssuesDataSection group={group} project={project} />
      <SimilarIssuesDataSection group={group} project={project} />
    </Fragment>
  );
}
