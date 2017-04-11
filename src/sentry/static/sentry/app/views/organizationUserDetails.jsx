/*eslint getsentry/jsx-needs-il8n:0*/
import React from 'react';
import Avatar from '../components/avatar';
import ApiMixin from '../mixins/apiMixin';
import ListLink from '../components/listLink';
import {t} from '../locale';



const OrganizationUserDetails = React.createClass({
  mixins: [
    ApiMixin,
  ],

  getInitialState() {
    return {
      loading: true,
      user: {},
    };
  },

  componentWillMount(){
    this.fetchData();
  },

  fetchData() {
    let params = this.props.params;
    let path = `/users/${params.userId}/`;
    this.api.request(path, {
      method: 'GET',
      success: (data) => {
        this.setState({
          user: data,
          loading: false,
          error: false,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      }
    });
  },

  render() {
    let params = this.props.params;
    let user = this.state.user;
    let basePath = `/organizations/${params.orgId}/users/${params.userId}/`;
    return (
      <div>
        <Avatar user={user} />
        <h3>{user.name}</h3>
        <ul className="nav nav-tabs">
          <ListLink to={`/organizations/${params.orgId}/users/${params.userId}/`}
            isActive={(loc) => {
                // react-router isActive will return true for any route that is part of the active route
                // e.g. parent routes. To avoid matching on sub-routes, insist on strict path equality.
                return (this.props.location.pathname === basePath) ||
                       (loc.pathname === this.props.location.pathname);
            }}>
            {t('Issues Assigned')}
          </ListLink>
          <ListLink to={`/organizations/${params.orgId}/users/${params.userId}/resolved/`}>{t('Issues Resolved')}</ListLink>
        </ul>
      </div>
    );
  }
});

export default OrganizationUserDetails;
