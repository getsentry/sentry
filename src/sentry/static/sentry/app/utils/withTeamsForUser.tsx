import React from 'react';

import {Team, Organization} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';
import {Client} from 'app/api';

// We require these props when using this HOC
type DependentProps = {
  api: Client;
  organization: Organization;
};

type InjectedTeamsProps = {
  teams: Team[];
  loadingTeams: boolean;
  error: Error | null;
};

const withTeamsForUser = <P extends InjectedTeamsProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  class extends React.Component<
    Omit<P, keyof InjectedTeamsProps> & Partial<InjectedTeamsProps> & DependentProps,
    InjectedTeamsProps
  > {
    static displayName = `withUsersTeams(${getDisplayName(WrappedComponent)})`;

    state = {
      teams: [],
      loadingTeams: true,
      error: null,
    };

    componentDidMount() {
      this.fetchTeams();
    }

    async fetchTeams() {
      this.setState({
        loadingTeams: true,
      });
      try {
        const teams = await this.props.api.requestPromise(this.getUsersTeamsEndpoint());
        this.setState({
          teams,
          loadingTeams: false,
        });
      } catch (error) {
        this.setState({
          error,
          loadingTeams: false,
        });
      }
    }

    getUsersTeamsEndpoint() {
      return `/organizations/${this.props.organization.slug}/user-teams/`;
    }

    render() {
      return <WrappedComponent {...this.props as (P & DependentProps)} {...this.state} />;
    }
  };

export default withTeamsForUser;
