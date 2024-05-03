import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';

import SimilarStackTrace from './similarStackTrace';

type Props = React.ComponentProps<typeof SimilarStackTrace>;

function GroupSimilarIssues({project, ...props}: Props) {
  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <Feature features="related-issues">
          <GroupRelatedIssues {...props} />
        </Feature>
        <Feature features="similarity-view" project={project}>
          <SimilarStackTrace project={project} {...props} />
        </Feature>
      </Layout.Main>
    </Layout.Body>
  );
}

export default GroupSimilarIssues;
