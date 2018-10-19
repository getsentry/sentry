import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import {fetchTeamDetails} from 'app/actionCreators/teams';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import IdBadge from 'app/components/idBadge';
import ListLink from 'app/components/listLink';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NavTabs from 'app/components/navTabs';
import OrganizationState from 'app/mixins/organizationState';
import TeamStore from 'app/stores/teamStore';
import recreateRoute from 'app/utils/recreateRoute';

const TeamDetails = createReactClass({
  displayName: 'TeamDetails',

  propTypes: {
    routes: PropTypes.array,
  },

  mixins: [ApiMixin, OrganizationState, Reflux.listenTo(TeamStore, 'onTeamStoreUpdate')],

  getInitialState() {
    let team = TeamStore.getBySlug(this.props.params.teamId);

    return {
      loading: !TeamStore.initialized,
      error: false,
      team,
    };
  },

  componentWillReceiveProps(nextProps) {
    let params = this.props.params;
    if (
      nextProps.params.teamId !== params.teamId ||
      nextProps.params.orgId !== params.orgId
    ) {
      this.setState(
        {
          loading: true,
          error: false,
        },
        this.fetchData
      );
    }
  },

  onTeamStoreUpdate(...args) {
    let team = TeamStore.getBySlug(this.props.params.teamId);
    let loading = !TeamStore.initialized;
    let error = !loading && !team;
    this.setState({
      team,
      error,
      loading,
    });
  },

  fetchData() {
    fetchTeamDetails(this.api, this.props.params);
  },

  onTeamChange(data) {
    let team = this.state.team;
    if (data.slug !== team.slug) {
      let orgId = this.props.params.orgId;
      browserHistory.push(`/organizations/${orgId}/teams/${data.slug}/settings/`);
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
    let {params, routes, children} = this.props;
    let team = this.state.team;

    if (this.state.loading) return <LoadingIndicator />;
    else if (!team || this.state.error)
      return (
        <LoadingError
          message={t('You do not have permission to view members for this team.')}
          onRetry={this.fetchData}
        />
      );

    let routePrefix = recreateRoute('', {routes, params, stepBack: -1}); //`/organizations/${orgId}/teams/${teamId}`;

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

export default TeamDetails;
