import React from 'react';

import Feature from 'app/components/acl/feature';
import {Project, Group} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import SimilarStackTrace from './similarStackTrace';
import SimilarTraceID from './similarTraceID';

type Props = React.ComponentProps<typeof SimilarTraceID> & {
  project: Project;
  group: Group;
};

const GroupSimilarIssues = ({
  event,
  organization,
  location,
  project,
  group,
  ...props
}: Props) => (
  <React.Fragment>
    <Feature features={['similarity-view']} project={project}>
      <SimilarStackTrace
        project={project}
        location={location}
        group={group}
        query={location.query}
        {...props}
      />
    </Feature>
    <Feature features={['related-events']} organization={organization}>
      <Feature
        features={['discover-basic', 'performance-view']}
        organization={organization}
      >
        <SimilarTraceID event={event} organization={organization} location={location} />
      </Feature>
    </Feature>
  </React.Fragment>
);

export default withOrganization(GroupSimilarIssues);
