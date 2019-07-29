import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {fetchTeamDetails} from 'app/actionCreators/teams';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import IdBadge from 'app/components/idBadge';
import ListLink from 'app/components/links/listLink';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NavTabs from 'app/components/navTabs';
import TeamStore from 'app/stores/teamStore';
import recreateRoute from 'app/utils/recreateRoute';
import withApi from 'app/utils/withApi';

const TeamDetails = createReactClass({
  displayName: 'TeamDetails',

  propTypes: {
    api: PropTypes.object,
    routes: PropTypes.array,
  },

  mixins: [Reflux.listenTo(TeamStore, 'onTeamStoreUpdate')],

  getInitialState() {
    const team = TeamStore.getBySlug(this.props.params.teamId);

    return {
      loading: !TeamStore.initialized,
      error: false,
      team,
    };
  },

  componentDidUpdate(prevProps) {
    const {params} = this.props;

    if (
      prevProps.params.teamId !== params.teamId ||
      prevProps.params.orgId !== params.orgId
    ) {
      this.fetchData();
    }
  },

  onTeamStoreUpdate() {
    const team = TeamStore.getBySlug(this.props.params.teamId);
    const loading = !TeamStore.initialized;
    const error = !loading && !team;
    this.setState({
      team,
      error,
      loading,
    });
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });
    fetchTeamDetails(this.props.api, this.props.params);
  },

  onTeamChange(data) {
    const team = this.state.team;
    if (data.slug !== team.slug) {
      const orgId = this.props.params.orgId;
      browserHistory.replace(`/organizations/${orgId}/teams/${data.slug}/settings/`);
    } else {
      this.setState({
        team: {
          ...team,
          ...data,
        },
      });
    }
  },

  render() {
    const {params, routes, children} = this.props;
    const team = this.state.team;

    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (!team || !team.hasAccess) {
      return (
        <Alert type="error">
          {t('This team does not exist or you do not have access to this team')}
        </Alert>
      );
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    const routePrefix = recreateRoute('', {routes, params, stepBack: -1}); //`/organizations/${orgId}/teams/${teamId}`;

    return (
      <div>
        <h3>
          <IdBadge hideAvatar team={team} avatarSize={36} />
        </h3>

        <NavTabs underlined={true}>
          <ListLink to={`${routePrefix}members/`}>{t('Members')}</ListLink>
          <ListLink to={`${routePrefix}projects/`}>{t('Projects')}</ListLink>
          <ListLink to={`${routePrefix}settings/`}>{t('Settings')}</ListLink>
        </NavTabs>

        {children &&
          React.cloneElement(children, {
            team,
            onTeamChange: this.onTeamChange,
          })}
      </div>
    );
  },
});

export {TeamDetails};

export default withApi(TeamDetails);
