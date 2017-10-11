import React from 'react';
import {Link} from 'react-router';

import ApiMixin from '../../../mixins/apiMixin';
import Avatar from '../../../components/avatar';
import Button from '../../../components/buttons/button';
import LoadingError from '../../../components/loadingError';
import LoadingIndicator from '../../../components/loadingIndicator';
import OrganizationState from '../../../mixins/organizationState';
import recreateRoute from '../../../utils/recreateRoute';
import {t} from '../../../locale';

const TeamMembers = React.createClass({
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

    let {params, routes} = this.props;

    let access = this.getAccess();

    return (
      <div>
        <div style={{marginBottom: 20}} className="clearfix">
          {access.has('org:write') ? (
            <Button
              priority="primary"
              size="small"
              className="pull-right"
              to={`${recreateRoute('members/new/', {routes, params, stepBack: -2})}`}
            >
              <span className="icon-plus" /> {t('Invite Member')}
            </Button>
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
                    <Avatar user={member} size={80} />
                    <h5>
                      <Link
                        to={`${recreateRoute(`members/${member.id}`, {
                          routes,
                          params,
                          stepBack: -2,
                        })}`}
                      >
                        {member.email}
                      </Link>
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
