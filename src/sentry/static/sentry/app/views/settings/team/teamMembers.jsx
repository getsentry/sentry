import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import ApiMixin from '../../../mixins/apiMixin';
import UserBadge from '../../../components/userBadge';
import Button from '../../../components/buttons/button';
import DropdownAutoComplete from '../../../components/dropdownAutoComplete';
import DropdownButton from '../../../components/dropdownButton';
import IndicatorStore from '../../../stores/indicatorStore';
import {joinTeam, leaveTeam} from '../../../actionCreators/teams';
import LoadingError from '../../../components/loadingError';
import LoadingIndicator from '../../../components/loadingIndicator';
import OrganizationState from '../../../mixins/organizationState';
import Panel from '../components/panel';
import PanelHeader from '../components/panelHeader';
import InlineSvg from '../../../components/inlineSvg';
import EmptyMessage from '../components/emptyMessage';
import {t} from '../../../locale';

const TeamMembers = createReactClass({
  displayName: 'TeamMembers',
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      teamMemberList: null,
      orgMemberList: null,
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
            teamMemberList: this.state.teamMemberList.filter(m => {
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
          teamMemberList: data,
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

    this.api.request(`/organizations/${params.orgId}/members/`, {
      success: data => {
        this.setState({
          orgMemberList: data,
        });
      },
      error: () => {
        IndicatorStore.add(t('Unable to load organization members.'), 'error', {
          duration: 2000,
        });
      },
    });
  },

  addTeamMember(selection) {
    let params = this.props.params;

    this.setState({
      loading: true,
    });

    joinTeam(
      this.api,
      {
        orgId: params.orgId,
        teamId: params.teamId,
        memberId: selection.value,
      },
      {
        success: () => {
          let orgMember = this.state.orgMemberList.find(member => {
            return member.id === selection.value;
          });
          this.setState({
            loading: false,
            error: false,
            teamMemberList: this.state.teamMemberList.concat([orgMember]),
          });
          IndicatorStore.add(t('Successfully added member to team.'), 'success', {
            duration: 2000,
          });
        },
        error: () => {
          this.setState({
            loading: false,
          });
          IndicatorStore.add(t('Unable to add team member.'), 'error', {duration: 2000});
        },
      }
    );
  },

  renderDropdown(access) {
    if (!access.has('org:write')) {
      return (
        <a
          className="btn btn-default btn-disabled tip pull-right"
          title={t('You do not have enough permission to add new members')}
        >
          <span className="icon-plus" /> {t('Add Member')}
        </a>
      );
    }

    let existingMembers = new Set(this.state.teamMemberList.map(member => member.id));

    let items = (this.state.orgMemberList || [])
      .filter(m => !existingMembers.has(m.id))
      .map(m => {
        return {
          value: m.id,
          label: m.name || m.email,
        };
      });

    return (
      <DropdownAutoComplete items={items} onSelect={this.addTeamMember}>
        {({isOpen, selectedItem}) => (
          <DropdownButton isOpen={isOpen}>
            <span className="icon-plus" /> {t('Add Member')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  },

  removeButton(member) {
    return (
      <Button size="small" onClick={this.removeMember.bind(this, member)}>
        <InlineSvg
          src="icon-circle-subtract"
          size="1.25em"
          style={{marginRight: '0.5em'}}
        />
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
            <div style={{textTransform: 'none'}}>{this.renderDropdown(access)}</div>
          </StyledHeaderContainer>
        </PanelHeader>
        {this.state.teamMemberList.length ? (
          this.state.teamMemberList.map((member, i) => (
            <StyledMemberContainer key={i}>
              <UserBadge user={member} orgId={params.orgId} />
              {access.has('org:write') && this.removeButton(member)}
            </StyledMemberContainer>
          ))
        ) : (
          <EmptyMessage icon="icon-user">Your Team is Empty</EmptyMessage>
        )}
      </Panel>
    );
  },
});

const StyledHeaderContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 1em;
  padding-right: 1em;
`;

const StyledMemberContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: 1.25em 1em;
  border-bottom: 1px solid ${p => p.theme.borderLight};
`;

export default TeamMembers;
