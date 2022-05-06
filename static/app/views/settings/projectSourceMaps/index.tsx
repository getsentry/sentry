import {cloneElement, isValidElement} from 'react';
import {RouteComponentProps} from 'react-router';

import {Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  children: React.ReactNode;
  organization: Organization;
  project: Project;
};

function ProjectSourceMapsContainer(props: Props) {
  const {children, organization, project} = props;
  return isValidElement(children)
    ? cloneElement(children, {organization, project})
    : null;
}

export default withOrganization(ProjectSourceMapsContainer);
