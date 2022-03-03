import {cloneElement, isValidElement} from 'react';
import type {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
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

  return (
    <Feature organization={organization} features={['alert-rule-status-page']}>
      {children && isValidElement(children)
        ? cloneElement(children, {
            organization,
            project: projects[0],
          })
        : null}
    </Feature>
  );
}

export default RuleDetailsContainer;
