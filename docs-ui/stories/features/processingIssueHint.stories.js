import {Fragment} from 'react';

import ProcessingIssueHint from 'sentry/components/stream/processingIssueHint';

export default {
  title: 'Features/Issues/Processing Issue Hint',
  args: {
    showProject: false,
  },
};

export const Default = ({showProject}) => {
  const issue = {
    project: 'sentry-test',
    numIssues: 6,
    issuesProcessing: 4,
    resolvableIssues: 2,
    signedLink: '',
    lastSeen: new Date().toISOString(),
    hasMoreResolvableIssues: true,
    hasIssues: true,
  };

  const warning = {...issue, numIssues: 0};
  const info = {...issue, numIssues: 0, issuesProcessing: 0};

  return (
    <Fragment>
      <ProcessingIssueHint
        issue={issue}
        projectId={issue.project}
        orgId="organization-slug"
        showProject={showProject}
      />
      <br />
      <ProcessingIssueHint
        issue={warning}
        projectId={warning.project}
        orgId="organization-slug"
        showProject={showProject}
      />
      <br />
      <ProcessingIssueHint
        issue={info}
        projectId={info.project}
        orgId="organization-slug"
        showProject={showProject}
      />
    </Fragment>
  );
};

Default.storyName = 'Processing Issue Hint';
