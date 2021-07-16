import {RouteComponentProps} from 'react-router';

import {loadStats} from 'app/actionCreators/projects';
import {Client} from 'app/api';
import { Organization, Team, AccessRequest } from 'app/types';
import {sortArray} from 'app/utils';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withTeams from 'app/utils/withTeams';

import OrganizationTeams from './organizationTeams';


import AsyncView from 'app/views/asyncView';

type Props = {
  api: Client;
  organization: Organization;
  teams: Team[];
} & RouteComponentProps<{orgId: string}, {}>;

type State = AsyncView['state'] & {
  requestList: AccessRequest[];
};

class OrganizationTeamsContainer extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const { orgId } = this.props.params;

    return [
      ['requestList', `/organizations/${orgId}/access-requests/`],
    ];
  }

  componentDidMount() {
    this.fetchStats();
  }

  fetchStats() {
    loadStats(this.props.api, {
      orgId: this.props.params.orgId,
      query: {
        since: (new Date().getTime() / 1000 - 3600 * 24).toString(),
        stat: 'generated',
        group: 'project',
      },
    });
  }

  renderBody() {
    const {organization, teams} = this.props;

    if (!organization) {
      return null;
    }
    const allTeams = sortArray(teams, team => team.name);
    const activeTeams = allTeams.filter(team => team.isMember);

    return (
      <OrganizationTeams
        {...this.props}
        access={new Set(organization.access)}
        features={new Set(organization.features)}
        organization={organization}
        allTeams={allTeams}
        activeTeams={activeTeams}
        requestList={this.state.requestList}
      />
    );
  }
}

export {OrganizationTeamsContainer};

export default withApi(withOrganization(withTeams(OrganizationTeamsContainer)));
