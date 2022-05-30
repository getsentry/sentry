import {cloneElement, isValidElement} from 'react';
import type {RouteComponentProps} from 'react-router';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

interface Props
  extends RouteComponentProps<{orgId: string; projectId: string; ruleId: string}, {}> {
  children?: React.ReactNode;
}

function RuleDetailsContainer({children, params}: Props) {
  const organization = useOrganization();
  const {projects, fetching} = useProjects({slugs: [params.projectId]});

  // Should almost never need to fetch project
  if (fetching) {
    return <LoadingIndicator />;
  }

  return children && isValidElement(children)
    ? cloneElement(children, {
        organization,
        project: projects[0],
      })
    : null;
}

export default RuleDetailsContainer;
