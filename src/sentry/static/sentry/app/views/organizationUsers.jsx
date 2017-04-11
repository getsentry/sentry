/*eslint getsentry/jsx-needs-il8n:0*/
import React from 'react';

import Link from '../components/link';
import Avatar from '../components/avatar';
import OrganizationHomeContainer from '../components/organizations/homeContainer';
import ApiMixin from '../mixins/apiMixin';

const OrganizationUsers = React.createClass({

  mixins: [
    ApiMixin,
  ],

  getInitialState() {
    return {
      loading: true,
      userList: [],
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    let params = this.props.params;

    this.api.request(`/organizations/${params.orgId}/members/`, {
      method: 'GET',
      success: (data) => {
        this.setState({
          userList: data,
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

  render() {
    let params = this.props.params;
    let userList = this.state.userList;
    return (
      <OrganizationHomeContainer>
        {userList.map(user => {
          return (
            <div>
              <Link to={`/organizations/${params.orgId}/users/${user.id}/`}>
                <Avatar user={user} className="avatar" size={48} />
                <span>{user.name} </span>
                <span>{user.email}</span>
              </Link>
            </div>
          );
        })}
      </OrganizationHomeContainer>
    );
  }
});

export default OrganizationUsers;
