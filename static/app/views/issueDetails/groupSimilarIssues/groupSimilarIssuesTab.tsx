import * as Layout from 'sentry/components/layouts/thirds';
import GroupSimilarIssues from 'sentry/views/issueDetails/groupSimilarIssues/similarIssues';

import type SimilarStackTrace from './similarStackTrace';

type Props = React.ComponentProps<typeof SimilarStackTrace>;

function GroupSimilarIssuesTab(props: Props) {
  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <GroupSimilarIssues {...props} />
      </Layout.Main>
    </Layout.Body>
  );
}

export default GroupSimilarIssuesTab;
