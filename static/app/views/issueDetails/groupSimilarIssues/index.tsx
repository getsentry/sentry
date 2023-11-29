import Feature from 'sentry/components/acl/feature';

import SimilarStackTrace from './similarStackTrace';

type Props = React.ComponentProps<typeof SimilarStackTrace>;

function GroupSimilarIssues({project, ...props}: Props) {
  return (
    <Feature feature="similarity-view" project={project}>
      <SimilarStackTrace project={project} {...props} />
    </Feature>
  );
}

export default GroupSimilarIssues;
