import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {loadStats} from 'app/actionCreators/projects';
import {Client} from 'app/api';
import {Organization, Team} from 'app/types';
import {sortArray} from 'app/utils';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withTeams from 'app/utils/withTeams';

import OrganizationTeams from './organizationTeams';

type Props = {
  api: Client;
  organization: Organization;
  teams: Team[];
} & RouteComponentProps<{orgId: string}, {}>;

class OrganizationTeamsContainer extends React.Component<Props> {
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

  render() {
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
      />
    );
  }
}

export {OrganizationTeamsContainer};

export default withApi(withOrganization(withTeams(OrganizationTeamsContainer)));
