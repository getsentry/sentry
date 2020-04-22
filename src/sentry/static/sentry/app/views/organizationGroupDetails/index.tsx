import * as ReactRouter from 'react-router';
import React from 'react';

import {analytics} from 'app/utils/analytics';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import {GlobalSelection, Organization} from 'app/types';

import GroupDetails from './groupDetails';

type Props = {
  selection: GlobalSelection;
  organization: Organization;
  children: React.ReactNode;
} & ReactRouter.RouteComponentProps<{orgId: string; groupId: string}, {}>;

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

export default withOrganization(withGlobalSelection(OrganizationGroupDetails));
