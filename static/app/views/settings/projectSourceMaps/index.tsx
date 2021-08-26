import * as React from 'react';
import {RouteComponentProps} from 'react-router';

import {Organization, Project} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
  children: React.ReactNode;
};

function ProjectSourceMapsContainer(props: Props) {
  const {children, organization, project} = props;
  return React.isValidElement(children)
    ? React.cloneElement(children, {organization, project})
    : null;
}

export default withOrganization(ProjectSourceMapsContainer);
