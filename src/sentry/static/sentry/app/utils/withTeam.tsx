import React from 'react';
import Reflux from 'reflux';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Client} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {Team} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';
import TeamStore from 'app/stores/teamStore';
import withApi from 'app/utils/withApi';

type InjectedTeamsProps = RouteComponentProps<{orgSlug: string; teamSlug: string}, {}>;

type State = {
  team: Team | null;
  isLoading: boolean;
};

/**
 * Higher order component that uses TeamStore and provides details of a team
 */
const withTeam = <P extends InjectedTeamsProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  withApi(
    createReactClass<Omit<P & {api: Client}, keyof InjectedTeamsProps>, State>({
      displayName: `withTeam(${getDisplayName(WrappedComponent)})`,

      propTypes: {
        api: PropTypes.object,
        teamSlug: PropTypes.string,
      },

      mixins: [Reflux.listenTo(TeamStore, 'onTeamUpdate') as any],

      getInitialState() {
        return {
          team: TeamStore.getBySlug(this.props.params.teamSlug),
          isLoading: TeamStore.getState().isLoading,
        };
      },

      componentDidMount() {
        this.fetchTeamMembers();
      },

      async fetchTeamMembers() {
        const {orgSlug, teamSlug} = this.props.params;
        try {
          const result = await this.props.api.requestPromise(
            `/teams/${orgSlug}/${teamSlug}/members/`,
            {
              method: 'GET',
            }
          );

          this.setState((prevState: State) => ({
            team: {...prevState.team, members: result},
          }));

          // return result;
        } catch (err) {
          addErrorMessage(t("Unable to fetch team's members"));
        }
      },

      onTeamUpdate() {
        this.setState({
          team: TeamStore.getBySlug(this.props.params.teamSlug),
          isLoading: TeamStore.getState().isLoading,
        });
      },

      render() {
        const {team, isLoading} = this.state;
        return (
          <WrappedComponent
            {...(this.props as P)}
            team={team as Team}
            isLoading={isLoading}
          />
        );
      },
    })
  );

export default withTeam;
