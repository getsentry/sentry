import {Link} from 'react-router';
import React from 'react';

import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import Avatar from 'app/components/avatar';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationState from 'app/mixins/organizationState';

const TeamMembers = createReactClass({
  displayName: 'TeamMembers',
  mixins: [ApiMixin, OrganizationState],

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

  fetchData() {
    let params = this.props.params;

    this.api.request(`/teams/${params.orgId}/${params.teamId}/members/`, {
      success: data => {
        this.setState({
          memberList: data,
          loading: false,
          error: false,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    let {orgId} = this.props.params;
    let memberPrefix = `/organizations/${orgId}/members`;
    let access = this.getAccess();

    return (
      <div>
        <div style={{marginBottom: 20}} className="clearfix">
          {access.has('org:write') ? (
            <Link
              className="btn btn-primary btn-sm pull-right"
              to={`${memberPrefix}/new/`}
            >
              <span className="icon-plus" /> {t('Invite Member')}
            </Link>
          ) : (
            <a
              className="btn btn-primary btn-sm btn-disabled tip pull-right"
              title={t('You do not have enough permission to add new members')}
            >
              <span className="icon-plus" /> {t('Invite Member')}
            </a>
          )}
        </div>

        <table className="table member-list">
          <colgroup>
            <col />
            <col width="150" />
          </colgroup>
          <thead>
            <tr>
              <th>{t('Member')}</th>
              <th>{t('Role')}</th>
            </tr>
          </thead>
          <tbody>
            {this.state.memberList.map((member, i) => {
              return (
                <tr key={i}>
                  <td className="table-user-info">
                    <Avatar user={member} size={36} />
                    <h5>
                      <Link to={`${memberPrefix}/${member.id}/`}>{member.email}</Link>
                    </h5>
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
  },
});

export default TeamMembers;
