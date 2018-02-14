import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';

import ApiMixin from '../../../mixins/apiMixin';
import Avatar from '../../../components/avatar';
import Button from '../../../components/buttons/button';
import IndicatorStore from '../../../stores/indicatorStore';
import {leaveTeam} from '../../../actionCreators/teams';
import LoadingError from '../../../components/loadingError';
import LoadingIndicator from '../../../components/loadingIndicator';
import OrganizationState from '../../../mixins/organizationState';
import Tooltip from '../../../components/tooltip';
import {t} from '../../../locale';

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

  removeMember(member) {
    let {params} = this.props;
    leaveTeam(
      this.api,
      {
        orgId: params.orgId,
        teamId: params.teamId,
        memberId: member.id,
      },
      {
        success: () => {
          this.setState({
            memberList: this.state.memberList.filter(m => {
              return m.id !== member.id;
            }),
          });
          IndicatorStore.add(t('Successfully removed member from team.'), 'success', {
            duration: 2000,
          });
        },
        error: () => {
          IndicatorStore.add(
            t('There was an error while trying to remove a member from the team.'),
            'error',
            {duration: 2000}
          );
        },
      }
    );
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

    let {params} = this.props;

    let access = this.getAccess();

    return (
      <div>
        <div style={{marginBottom: 20}} className="clearfix">
          {access.has('org:write') ? (
            <Button
              priority="primary"
              size="small"
              className="pull-right"
              to={`/settings/organization/${params.orgId}/members/new/`}
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
                        to={`/settings/organization/${params.orgId}/members/${member.id}`}
                      >
                        {member.email}
                      </Link>
                    </h5>
                    {member.email}
                  </td>
                  <td>
                    {access.has('org:write') ? (
                      <Button size="small" onClick={this.removeMember.bind(this, member)}>
                        {t('Remove')}
                      </Button>
                    ) : (
                      <Tooltip
                        title={t("You don't have have permission to remove members")}
                      >
                        <span>
                          <Button size="small" disabled={true}>
                            {t('Remove')}
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                  </td>
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
