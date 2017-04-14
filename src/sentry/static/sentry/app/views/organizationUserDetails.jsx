/*eslint getsentry/jsx-needs-il8n:0*/
import React from 'react';
import Avatar from '../components/avatar';
import ApiMixin from '../mixins/apiMixin';
import ListLink from '../components/listLink';
import moment from 'moment';

// import Button from '../components/button';
import OrganizationHomeContainer from '../components/organizations/homeContainer';
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
    if(this.state.loading){
      return null;
    }
    return (
      <OrganizationHomeContainer>
        <a className="btn btn-default pull-right"
           href={`/organizations/${params.orgId}/members/${params.userId}/`}>
           <span className="icon icon-settings"/> Settings
         </a>
         <span style={{display: 'flex'}}>
          <Avatar user={user} size={170} className="avatar avatar-big"/>
          <div className="m-x-1">
            <h3 className="m-b-0">{user.name}</h3>
            <p className="m-b-0">joined {moment(user.dateJoined).format('MMMM Do YYYY')} </p>
            <p className="m-b-0">
            {user.emails.map(email => email.email).join(',\n')}
            </p>
          </div>
         </span>
        <ul className="nav nav-tabs" style={{borderBottom: '1px solid #e2dee6'}}>
          <ListLink to={`/organizations/${params.orgId}/users/${params.userId}/`}
            isActive={(loc) => {
                // react-router isActive will return true for any route that is part of the active route
                // e.g. parent routes. To avoid matching on sub-routes, insist on strict path equality.
                return (this.props.location.pathname === basePath) ||
                       (loc.pathname === this.props.location.pathname);
            }}>
            {t('Activity')}
          </ListLink>
          <ListLink to={`/organizations/${params.orgId}/users/${params.userId}/released/`}>{t('Release Activity')}</ListLink>
          <ListLink to={`/organizations/${params.orgId}/users/${params.userId}/assigned/`}>{t('Assigned')}</ListLink>
        </ul>
        {this.props.children}
      </OrganizationHomeContainer>
    );
  }
});

export default OrganizationUserDetails;
