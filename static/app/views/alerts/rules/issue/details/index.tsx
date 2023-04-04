import {cloneElement, isValidElement} from 'react';
import type {RouteComponentProps} from 'react-router';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

interface Props extends RouteComponentProps<{projectId: string; ruleId: string}, {}> {
  children?: React.ReactNode;
}

const RuleDetailsContainer = ({children, params}: Props) => {
  const organization = useOrganization();
  const {projects, fetching} = useProjects();
  const project = projects.find(({slug}) => slug === params.projectId);

  // Should almost never need to fetch project
  if (fetching) {
    return <LoadingIndicator />;
  }

  return children && isValidElement(children)
    ? cloneElement<any>(children, {
        organization,
        project,
      })
    : null;
};

export default RuleDetailsContainer;
