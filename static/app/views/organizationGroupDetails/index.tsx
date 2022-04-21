import {useEffect} from 'react';
import {RouteComponentProps} from 'react-router';

import {PageFilters} from 'sentry/types';
import {analytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import withPageFilters from 'sentry/utils/withPageFilters';

import GroupDetails from './groupDetails';

type Props = {
  children: React.ReactNode;
  isGlobalSelectionReady: boolean;
  selection: PageFilters;
} & RouteComponentProps<{groupId: string; orgId: string}, {}>;

function OrganizationGroupDetails({selection, ...props}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const {params} = props;

  useEffect(() => {
    analytics('issue_page.viewed', {
      group_id: parseInt(props.params.groupId, 10),
      org_id: parseInt(organization.id, 10),
    });
  }, [organization, params]);

  return (
    <GroupDetails
      key={`${params.groupId}-envs:${selection.environments.join(',')}`}
      environments={selection.environments}
      organization={organization}
      projects={projects}
      {...props}
    />
  );
}

export default withPageFilters(OrganizationGroupDetails);
