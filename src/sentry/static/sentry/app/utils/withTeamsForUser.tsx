import * as React from 'react';

import {Client} from 'app/api';
import {Organization, Project, Team, TeamWithProjects} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';
import getProjectsByTeams from 'app/utils/getProjectsByTeams';
import ConfigStore from 'app/stores/configStore';

import {metric} from './analytics';

// We require these props when using this HOC
type DependentProps = {
  api: Client;
  organization: Organization;
};

type InjectedTeamsProps = {
  teams: TeamWithProjects[];
  loadingTeams: boolean;
  error: Error | null;
};

const withTeamsForUser = <P extends InjectedTeamsProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  (class extends React.Component<
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
        metric.mark({name: 'user-teams-fetch-start'});
        const teamsWithProjects: TeamWithProjects[] = await this.props.api.requestPromise(
          this.getUsersTeamsEndpoint()
        );
        this.setState(
          {
            teams: teamsWithProjects,
            loadingTeams: false,
          },
          () => {
            metric.measure({
              name: 'app.component.perf',
              start: 'user-teams-fetch-start',
              data: {
                name: 'user-teams',
                route: '/organizations/:orgid/user-teams',
                organization_id: parseInt(this.props.organization.id, 10),
              },
            });
          }
        );
      } catch (error) {
        this.setState({
          error,
          loadingTeams: false,
        });
      }
    }

    populateTeamsWithProjects(teams: Team[], projects: Project[]) {
      const {isSuperuser} = ConfigStore.get('user');
      const {projectsByTeam} = getProjectsByTeams(teams, projects, isSuperuser);
      const teamsWithProjects: TeamWithProjects[] = teams.map(team => {
        const teamProjects = projectsByTeam[team.slug] || [];
        return {...team, projects: teamProjects};
      });
      this.setState({
        teams: teamsWithProjects,
        loadingTeams: false,
      });
    }

    getUsersTeamsEndpoint() {
      return `/organizations/${this.props.organization.slug}/user-teams/`;
    }

    render() {
      return <WrappedComponent {...(this.props as P & DependentProps)} {...this.state} />;
    }
  });

export default withTeamsForUser;
