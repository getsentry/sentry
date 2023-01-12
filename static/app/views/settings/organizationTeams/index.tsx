import {RouteComponentProps} from 'react-router';

import {loadStats} from 'sentry/actionCreators/projects';
import {Client} from 'sentry/api';
import TeamStore from 'sentry/stores/teamStore';
import {AccessRequest, Organization, Team} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import OrganizationTeams from './organizationTeams';

type Props = {
  api: Client;
  organization: Organization;
  teams: Team[];
} & RouteComponentProps<{}, {}>;

type State = AsyncView['state'] & {
  requestList: AccessRequest[];
};

class OrganizationTeamsContainer extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization} = this.props;

    return [['requestList', `/organizations/${organization.slug}/access-requests/`]];
  }

  componentDidMount() {
    this.fetchStats();
  }

  fetchStats() {
    const {organization} = this.props;
    loadStats(this.props.api, {
      orgId: organization.slug,
      query: {
        since: (new Date().getTime() / 1000 - 3600 * 24).toString(),
        stat: 'generated',
        group: 'project',
      },
    });
  }

  removeAccessRequest = (id: string, isApproved: boolean) => {
    const requestToRemove = this.state.requestList.find(request => request.id === id);
    this.setState(state => ({
      requestList: state.requestList.filter(request => request.id !== id),
    }));
    if (isApproved && requestToRemove) {
      const team = requestToRemove.team;
      TeamStore.onUpdateSuccess(team.slug, {
        ...team,
        memberCount: team.memberCount + 1,
      });
    }
  };

  renderBody() {
    const {organization} = this.props;

    if (!organization) {
      return null;
    }

    return (
      <OrganizationTeams
        {...this.props}
        access={new Set(organization.access)}
        features={new Set(organization.features)}
        organization={organization}
        requestList={this.state.requestList}
        onRemoveAccessRequest={this.removeAccessRequest}
      />
    );
  }
}

export {OrganizationTeamsContainer};

export default withApi(withOrganization(OrganizationTeamsContainer));
