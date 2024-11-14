import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';

import SimilarStackTrace from './similarStackTrace';

type Props = React.ComponentProps<typeof SimilarStackTrace>;

function GroupSimilarIssues({project, ...props}: Props) {
  return (
    <Fragment>
      <Feature features="related-issues">
        <GroupRelatedIssues {...props} />
      </Feature>
      <Feature features="similarity-view" project={project}>
        <SimilarStackTrace project={project} {...props} />
      </Feature>
    </Fragment>
  );
}

export default GroupSimilarIssues;
