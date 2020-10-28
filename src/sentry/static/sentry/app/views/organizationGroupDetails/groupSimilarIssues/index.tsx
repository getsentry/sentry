import React from 'react';

import Feature from 'app/components/acl/feature';

import SimilarStackTrace from './similarStackTrace';

type Props = React.ComponentProps<typeof SimilarStackTrace>;

const GroupSimilarIssues = ({project, ...props}: Props) => (
  <Feature features={['similarity-view']} project={project}>
    <SimilarStackTrace project={project} {...props} />
  </Feature>
);

export default GroupSimilarIssues;
