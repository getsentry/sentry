import React from 'react';

import ProcessingIssueHint from 'app/components/stream/processingIssueHint';

export default {
  title: 'Features/Issues/ProcessingIssueHint',
  args: {
    showProject: false,
  },
};

export const Default = ({showProject}) => {
  const issue = {
    project: 'sentry-test',
    numIssues: 6,
    issuesProcessing: 4,
    resolveableIssues: 2,
    signedLink: '',
    lastSeen: new Date().toISOString(),
    hasMoreResolveableIssues: true,
    hasIssues: true,
  };

  const warning = {...issue, numIssues: 0};
  const info = {...issue, numIssues: 0, issuesProcessing: 0};

  return (
    <React.Fragment>
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
    </React.Fragment>
  );
};

Default.storyName = 'default';
