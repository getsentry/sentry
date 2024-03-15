import Alert from 'sentry/components/alert';
import {ErrorMessageTitle} from 'sentry/components/performance/waterfall/rowDetails';
import {tn} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import type {TraceErrorOrIssue} from 'sentry/utils/performance/quickTrace/types';

import Issue from './issue';

type Props = {
  issues: TraceErrorOrIssue[];
  organization: Organization;
};

function IssueList({issues, organization}: Props) {
  if (!issues.length) {
    return null;
  }

  return (
    <Alert
      system
      defaultExpanded
      type="error"
      expand={issues.map(issue => (
        <Issue key={issue.issue_id} issue={issue} organization={organization} />
      ))}
    >
      <ErrorMessageTitle>
        {tn(
          '%s issue occurred in this transaction.',
          '%s issues occurred in this transaction.',
          issues.length
        )}
      </ErrorMessageTitle>
    </Alert>
  );
}

export default IssueList;
