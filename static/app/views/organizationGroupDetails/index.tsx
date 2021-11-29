import * as React from 'react';
import {RouteComponentProps} from 'react-router';

import {GlobalSelection, Organization, Project} from 'sentry/types';
import {analytics} from 'sentry/utils/analytics';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import GroupDetails from './groupDetails';
import SampleEventAlert from './sampleEventAlert';

type Props = {
  selection: GlobalSelection;
  isGlobalSelectionReady: boolean;
  organization: Organization;
  projects: Project[];
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
      <React.Fragment>
        <SampleEventAlert />

        <GroupDetails
          key={`${this.props.params.groupId}-envs:${selection.environments.join(',')}`}
          environments={selection.environments}
          {...props}
        />
      </React.Fragment>
    );
  }
}

export default withOrganization(
  withProjects(withGlobalSelection(OrganizationGroupDetails))
);
