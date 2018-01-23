import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import {fetchTeamDetails} from '../actionCreators/teams';
import {t} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import DropdownLink from '../components/dropdownLink';
import ListLink from '../components/listLink';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import MenuItem from '../components/menuItem';
import OrganizationState from '../mixins/organizationState';
import TeamStore from '../stores/teamStore';
import recreateRoute from '../utils/recreateRoute';

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
    else if (!team || this.state.error) return <LoadingError onRetry={this.fetchData} />;

    let routePrefix = recreateRoute('', {routes, params, stepBack: -1}); //`/organizations/${orgId}/teams/${teamId}`;
    let access = this.getAccess();

    return (
      <div>
        <h3>{team.name}</h3>

        {access.has('team:admin') && (
          <DropdownLink anchorRight title={t('More')}>
            <MenuItem href={`${routePrefix}remove/`}>{t('Remove Team')}</MenuItem>
          </DropdownLink>
        )}

        <ul className="nav nav-tabs border-bottom">
          <ListLink to={`${routePrefix}settings/`}>{t('Settings')}</ListLink>
          <ListLink to={`${routePrefix}members/`}>{t('Members')}</ListLink>
          <ListLink to={`${routePrefix}projects/`}>{t('Projects')}</ListLink>
        </ul>

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
