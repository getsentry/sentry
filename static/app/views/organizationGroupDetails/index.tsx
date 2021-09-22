import * as React from 'react';
import {RouteComponentProps} from 'react-router';

import {GlobalSelection, Organization, Project} from 'app/types';
import {analytics} from 'app/utils/analytics';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import GroupDetails from './groupDetails';

type Props = {
  selection: GlobalSelection;
  isGlobalSelectionReady: boolean;
  organization: Organization;
  projects: Project[];
  loadingProjects: boolean;
  children: React.ReactNode;
} & RouteComponentProps<{orgId: string; groupId: string}, {}>;

class OrganizationGroupDetails extends React.Component<Props> {
  componentDidMount() {
    analytics('issue_page.viewed', {
      group_id: parseInt(this.props.params.groupId, 10),
      org_id: parseInt(this.props.organization.id, 10),
    });
  }

  render() {
    const {selection, ...props} = this.props;

    return (
      <GroupDetails
        key={`${this.props.params.groupId}-envs:${selection.environments.join(',')}`}
        environments={selection.environments}
        {...props}
      />
    );
  }
}

export default withOrganization(
  withProjects(withGlobalSelection(OrganizationGroupDetails))
);
