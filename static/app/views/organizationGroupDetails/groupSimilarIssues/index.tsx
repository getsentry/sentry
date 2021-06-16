import * as React from 'react';

import SimilarStackTrace from './similarStackTrace';

type Props = React.ComponentProps<typeof SimilarStackTrace>;

const GroupSimilarIssues = ({project, ...props}: Props) => (
  <SimilarStackTrace project={project} {...props} />
);

export default GroupSimilarIssues;
