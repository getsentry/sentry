import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import * as Sentry from '@sentry/browser';
import debounce from 'lodash/debounce';

import {Client} from 'app/api';
import {DEFAULT_DEBOUNCE_DURATION} from 'app/constants';
import {Organization, Team} from 'app/types';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {removeAtArrayIndex} from 'app/utils/removeAtArrayIndex';
import {replaceAtArrayIndex} from 'app/utils/replaceAtArrayIndex';
import {t} from 'app/locale';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import withOrganization from 'app/utils/withOrganization';

import OrganizationTeams from './organizationTeams';

const TEAM_PAGE_LIMIT = 25;

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

type State = {
  activeTeams: Team[] | null;
  otherTeams: Team[] | null;
  hasMoreTeams: boolean;
};

class OrganizationTeamsContainer extends React.Component<Props, State> {
  state: State = {
    activeTeams: null,
    otherTeams: null,
    hasMoreTeams: false,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentWillUnmount() {
    this.allApi.clear();
    this.activeTeamsApi.clear();
  }

  allApi = new Client();
  activeTeamsApi = new Client();

  async fetchData() {
    this.setState({
      activeTeams: null,
      otherTeams: null,
    });

    this.fetchAllTeams();
    this.fetchActiveTeams();
  }

  async fetchActiveTeams() {
    const {orgId} = this.props.params;

    this.activeTeamsApi.clear();

    try {
      const resp = await this.activeTeamsApi.requestPromise(
        `/organizations/${orgId}/user-teams/`
      );
      this.setState({activeTeams: resp as Team[]});
    } catch (err) {
      const message = t('Unable to fetch your teams');
      addErrorMessage(message);
      Sentry.captureException(new Error(message));
    }
  }

  async fetchAllTeams(query?: string) {
    const {params} = this.props;
    const {orgId} = params;

    this.allApi.clear();

    try {
      const [resp, , jqXhr] = await this.allApi.requestPromise(
        `/organizations/${orgId}/teams/`,
        {
          includeAllArgs: true,
          query: {
            query,
            is_not_member: '1',
            per_page: TEAM_PAGE_LIMIT,
          },
        }
      );
      const link = jqXhr && jqXhr.getResponseHeader('Link');
      const parsedLink = link ? parseLinkHeader(link) : null;
      this.setState({
        otherTeams: resp as Team[],
        hasMoreTeams: !!parsedLink?.next?.results as boolean,
      });
    } catch (err) {
      const message = t('Unable to fetch teams in organization');
      addErrorMessage(message);
      Sentry.captureException(new Error(message));
    }
  }

  handleRequestAccess = async (team: Team, promise: Promise<Team>) => {
    const {otherTeams} = this.state;

    if (otherTeams === null) {
      return;
    }

    const teamIndex = otherTeams.findIndex(otherTeam => otherTeam.id === team.id);

    if (teamIndex === -1) {
      return;
    }

    try {
      const newTeam = await promise;

      this.setState(state => {
        if (!state.otherTeams) {
          return null;
        }

        // Remove from `otherTeams` and add to `activeTeams`
        return {
          otherTeams: replaceAtArrayIndex(state.otherTeams, teamIndex, newTeam),
        };
      });
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  handleCreateTeam = (team: Team) => {
    this.setState(state => ({
      activeTeams: [...state.activeTeams, team],
    }));
  };

  handleJoinTeam = async (team: Team, promise: Promise<Team>) => {
    const {otherTeams} = this.state;

    if (otherTeams === null) {
      return;
    }

    const index = otherTeams.findIndex(({id}) => id === team.id);
    if (index === -1) {
      return;
    }

    try {
      const newTeam = await promise;

      this.setState(state => {
        if (!state.otherTeams) {
          return null;
        }

        // Remove from `otherTeams` and add to `activeTeams`
        return {
          otherTeams: removeAtArrayIndex(state.otherTeams, index),
          activeTeams: [...state.activeTeams, newTeam],
        };
      });
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  handleLeaveTeam = async (team: Team, promise: Promise<Team>) => {
    const {activeTeams} = this.state;

    if (activeTeams === null) {
      return;
    }

    const index = activeTeams.findIndex(({id}) => id === team.id);
    if (index === -1) {
      return;
    }

    try {
      const newTeam = await promise;

      this.setState(state => {
        if (!state.activeTeams) {
          return null;
        }

        // Remove from `activeTeams` and add to `activeTeams`
        return {
          activeTeams: removeAtArrayIndex(state.activeTeams, index),
          otherTeams: [...state.otherTeams, newTeam],
        };
      });
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  searchTeams = (value: string) => {
    this.fetchAllTeams(value);
  };

  debouncedSearchTeams = debounce(this.searchTeams, DEFAULT_DEBOUNCE_DURATION);

  handleSearch = (e: React.ChangeEvent<HTMLInputElement>) =>
    this.debouncedSearchTeams(e.target.value);

  render() {
    const {organization} = this.props;
    const {otherTeams, activeTeams, hasMoreTeams} = this.state;

    return (
      <OrganizationTeams
        {...this.props}
        access={new Set(organization.access)}
        features={new Set(organization.features)}
        organization={organization}
        otherTeams={otherTeams}
        hasMoreTeams={hasMoreTeams}
        activeTeams={activeTeams}
        onSearch={this.handleSearch}
        onRequestAccess={this.handleRequestAccess}
        onJoinTeam={this.handleJoinTeam}
        onLeaveTeam={this.handleLeaveTeam}
        onCreateTeam={this.handleCreateTeam}
      />
    );
  }
}

export {OrganizationTeamsContainer};

export default withOrganization(OrganizationTeamsContainer);
