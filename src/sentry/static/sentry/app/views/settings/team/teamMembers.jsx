import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import ApiMixin from '../../../mixins/apiMixin';
import UserBadge from '../../../components/userBadge';
import Button from '../../../components/buttons/button';
import IndicatorStore from '../../../stores/indicatorStore';
import {leaveTeam} from '../../../actionCreators/teams';
import LoadingError from '../../../components/loadingError';
import LoadingIndicator from '../../../components/loadingIndicator';
import OrganizationState from '../../../mixins/organizationState';
import Panel from '../components/panel';
import PanelHeader from '../components/panelHeader';
import {t} from '../../../locale';

const StyledHeaderContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 1em;
  padding-right: 0.66em;
`;

const StyledMemberContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: 0.66em;
`;

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

  addMemberButton(access, orgId) {
    return access.has('org:write') ? (
      <Button
        priority="primary"
        size="small"
        className="pull-right"
        to={`/settings/organization/${orgId}/members/new/`}
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
    );
  },

  removeButton(member) {
    return (
      <Button size="small" onClick={this.removeMember.bind(this, member)}>
        {t('Remove')}
      </Button>
    );
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    let {params} = this.props;

    let access = this.getAccess();

    return (
      <Panel>
        <PanelHeader hasButtons disablePadding>
          <StyledHeaderContainer>
            <div>{t('Members')}</div>
            {this.addMemberButton(access, params.orgId)}
          </StyledHeaderContainer>
        </PanelHeader>
        {this.state.memberList.map((member, i) => (
          <StyledMemberContainer key={i}>
            <UserBadge user={member} orgId={params.orgId} />
            {access.has('org:write') && this.removeButton(member)}
          </StyledMemberContainer>
        ))}
      </Panel>
    );
  },
});

export default TeamMembers;
