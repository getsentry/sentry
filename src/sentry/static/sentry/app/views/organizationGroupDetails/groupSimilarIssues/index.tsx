import React from 'react';

import Feature from 'app/components/acl/feature';
import {Project, Group} from 'app/types';

import SimilarStackTrace from './similarStackTrace';
import SimilarTraceID from './similarTraceID';

type Props = React.ComponentProps<typeof SimilarTraceID> & {
  project: Project;
  group: Group;
};

const GroupSimilarIssues = ({location, project, group, ...props}: Props) => (
  <Feature features={['similarity-view']} project={project}>
    <SimilarStackTrace
      project={project}
      location={location}
      group={group}
      query={location.query}
      {...props}
    />
  </Feature>
);

export default GroupSimilarIssues;
