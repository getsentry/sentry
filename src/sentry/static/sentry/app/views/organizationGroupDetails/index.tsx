import * as ReactRouter from 'react-router';
import * as React from 'react';

import {analytics, metric} from 'app/utils/analytics';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization, {isLightweightOrganization} from 'app/utils/withOrganization';
import {GlobalSelection, Organization} from 'app/types';

import GroupDetails from './groupDetails';

type Props = {
  selection: GlobalSelection;
  isGlobalSelectionReady: boolean;
  organization: Organization;
  children: React.ReactNode;
} & ReactRouter.RouteComponentProps<{orgId: string; groupId: string}, {}>;

class OrganizationGroupDetails extends React.Component<Props> {
  constructor(props) {
    super(props);

    // Setup in the constructor as render() may be expensive
    this.startMetricCollection();
  }

  componentDidMount() {
    analytics('issue_page.viewed', {
      group_id: parseInt(this.props.params.groupId, 10),
      org_id: parseInt(this.props.organization.id, 10),
    });
  }

  /**
   * See "page-issue-list-start" for explanation on hot/cold-starts
   */
  startMetricCollection() {
    const startType = isLightweightOrganization(this.props.organization)
      ? 'cold-start'
      : 'warm-start';
    metric.mark({name: 'page-issue-details-start', data: {start_type: startType}});
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
