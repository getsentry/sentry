import React from 'react';
import _ from 'lodash';

import {Client} from 'app/api';
import {Team, Organization} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';
import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';

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

        // also fill up TeamStore and ProjectStore so org context does not have
        // to refetch org details due to lack of teams/projects
        const projects = _.uniqBy(_.flatten(teams.map(team => team.projects)), 'id');
        ProjectActions.loadProjects(projects);
        TeamActions.loadTeams(teams);
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
