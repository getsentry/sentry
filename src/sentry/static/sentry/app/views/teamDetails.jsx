import jQuery from 'jquery';
import React from 'react';
import {History} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import DropdownLink from '../components/dropdownLink';
import ListLink from '../components/listLink';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import MenuItem from '../components/menuItem';
import OrganizationState from '../mixins/organizationState';
import {t} from '../locale';

const TeamDetails = React.createClass({
  mixins: [
    ApiMixin,
    History,
    OrganizationState
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      team: null
    };
  },

  componentWillMount() {
    this.fetchData();
    jQuery(document.body).addClass('narrow');
  },

  componentWillReceiveProps(nextProps) {
    let params = this.props.params;
    if (nextProps.params.teamId !== params.teamId ||
        nextProps.params.orgId !== params.orgId) {
      this.setState({
        loading: true,
        error: false
      }, this.fetchData);
    }
  },

  componentWillUnmount() {
    jQuery(document.body).removeClass('narrow');
  },

  fetchData() {
    let params = this.props.params;

    this.api.request(`/teams/${params.orgId}/${params.teamId}/`, {
      success: (data) => {
        this.setState({
          team: data,
          loading: false,
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  onTeamChange(data) {
    let team = this.state.team;
    if (data.slug !== team.slug) {
      let orgId = this.props.params.orgId;
      this.history.pushState(null, `/organizations/${orgId}/teams/${data.slug}/settings/`);
    } else {
      Object.assign({}, team, data);
      this.setState({team: team});
    }
  },

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let team = this.state.team;
    let {orgId, teamId} = this.props.params;
    let routePrefix = `/organizations/${orgId}/teams/${teamId}`;
    let access = this.getAccess();

    return (
      <div className="container">
        <h3>{team.name}</h3>

        {access.has('team:delete') &&
          <DropdownLink topLevelClasses="pull-right anchor-right" className="dropdown-menu-right" title={t('More')}>
            <MenuItem href={`${routePrefix}/remove/`}>{t('Remove Team')}</MenuItem>
          </DropdownLink>
        }

        <ul className="nav nav-tabs border-bottom">
          <ListLink to={`${routePrefix}/settings/`}>{t('Settings')}</ListLink>
          <ListLink to={`${routePrefix}/members/`}>{t('Members')}</ListLink>
        </ul>

        {React.cloneElement(this.props.children, {
          team: team,
          onTeamChange: this.onTeamChange,
        })}
      </div>
    );
  }
});

export default TeamDetails;
