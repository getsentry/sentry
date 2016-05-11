import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import Avatar from '../components/avatar';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import OrganizationState from '../mixins/organizationState';
import {t} from '../locale';

const TeamMembers = React.createClass({
  mixins: [
    ApiMixin,
    OrganizationState
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      memberList: null,
    };
  },

  componentWillMount() {
    this.fetchData();
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

  fetchData() {
    let params = this.props.params;

    this.api.request(`/teams/${params.orgId}/${params.teamId}/members/`, {
      success: (data) => {
        this.setState({
          memberList: data,
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
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let {orgId} = this.props.params;
    let memberPrefix = `/organizations/${orgId}/members`;
    let access = this.getAccess();

    return (
      <div>
        <div style={{marginBottom: 20}} className="clearfix">
          {access.has('org:write') ?
            <a className="btn btn-primary btn-sm pull-right" href={`${memberPrefix}/new/`}>
              <span className="icon-plus" /> {t('Invite Member')}
            </a>
          :
            <a className="btn btn-primary btn-sm btn-disabled tip pull-right"
               title={t('You do not have enough permission to add new members')}>
              <span className="icon-plus" /> {t('Invite Member')}
            </a>
          }
        </div>

        <table className="table member-list">
          <colgroup>
            <col />
            <col width="150"/>
          </colgroup>
          <thead>
            <tr>
              <th>{t('Member')}</th>
              <th>{t('Role')}</th>
            </tr>
          </thead>
          <tbody>
            {this.state.memberList.map((member) => {
              return (
                <tr>
                  <td className="table-user-info">
                    <Avatar user={member} size={80} />
                    <h5><a href={`${memberPrefix}/${member.id}/`}>{member.email}</a></h5>
                    {member.email}
                  </td>
                  <td>{member.roleName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
});

export default TeamMembers;
