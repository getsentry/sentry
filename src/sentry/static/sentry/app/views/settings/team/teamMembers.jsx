import {debounce} from 'lodash';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import ApiMixin from 'app/mixins/apiMixin';
import IdBadge from 'app/components/idBadge';
import Avatar from 'app/components/avatar';
import Button from 'app/components/buttons/button';
import Link from 'app/components/link';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import IndicatorStore from 'app/stores/indicatorStore';
import {joinTeam, leaveTeam} from 'app/actionCreators/teams';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationState from 'app/mixins/organizationState';
import {Panel, PanelHeader} from 'app/components/panels';
import InlineSvg from 'app/components/inlineSvg';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {t} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

const TeamMembers = createReactClass({
  displayName: 'TeamMembers',
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      dropdownBusy: false,
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

  debouncedFetchMembersRequest: debounce(function(query) {
    this.setState(
      {
        dropdownBusy: true,
      },
      () => this.fetchMembersRequest(query)
    );
  }, 200),

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

  fetchMembersRequest(query) {
    let {orgId} = this.props.params;
    return this.api.request(`/organizations/${orgId}/members/`, {
      query: {
        query,
      },
      success: data => {
        this.setState({
          orgMemberList: data,
          dropdownBusy: false,
        });
      },
      error: () => {
        IndicatorStore.add(t('Unable to load organization members.'), 'error', {
          duration: 2000,
        });
        this.setState({
          dropdownBusy: false,
        });
      },
    });
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

    this.fetchMembersRequest('');
  },

  addTeamMember(selection) {
    let params = this.props.params;

    this.setState({
      loading: true,
    });

    // Reset members list after adding member to team
    this.debouncedFetchMembersRequest('');

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

  /**
 * We perform an API request to support orgs with > 100 members (since that's the max API returns)
 *
 * @param {Event} e React Event when member filter input changes
 */
  handleMemberFilterChange(e) {
    this.setState({dropdownBusy: true});
    this.debouncedFetchMembersRequest(e.target.value);
  },

  renderDropdown(access) {
    let {params} = this.props;

    if (!access.has('org:write')) {
      return (
        <DropdownButton
          disabled={true}
          title={t('You do not have enough permission to add new members')}
          isOpen={false}
          size="xsmall"
        >
          {t('Add Member')}
        </DropdownButton>
      );
    }

    let existingMembers = new Set(this.state.teamMemberList.map(member => member.id));

    let items = (this.state.orgMemberList || [])
      .filter(m => !existingMembers.has(m.id))
      .map(m => {
        return {
          searchKey: `${m.name} ${m.email}`,
          value: m.id,
          label: (
            <StyledUserListElement>
              <StyledAvatar user={m} size={24} className="avatar" />
              <StyledNameOrEmail>{m.name || m.email}</StyledNameOrEmail>
            </StyledUserListElement>
          ),
        };
      });

    let menuHeader = (
      <StyledMembersLabel>
        {t('Members')}
        <StyledCreateMemberLink to={`/settings/${params.orgId}/members/new/`}>
          {t('Add Member')}
        </StyledCreateMemberLink>
      </StyledMembersLabel>
    );

    return (
      <DropdownAutoComplete
        items={items}
        onSelect={this.addTeamMember}
        menuHeader={menuHeader}
        emptyMessage={t('No members')}
        onChange={this.handleMemberFilterChange}
        busy={this.state.dropdownBusy}
        onClose={() => this.debouncedFetchMembersRequest('')}
      >
        {({isOpen, selectedItem}) => (
          <DropdownButton isOpen={isOpen} size="xsmall">
            {t('Add Member')}
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
          style={{marginRight: space(1)}}
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
        <PanelHeader hasButtons>
          <div>{t('Members')}</div>
          <div style={{textTransform: 'none'}}>{this.renderDropdown(access)}</div>
        </PanelHeader>
        {this.state.teamMemberList.length ? (
          this.state.teamMemberList.map(member => (
            <StyledMemberContainer key={member.id}>
              <IdBadge avatarSize={36} member={member} useLink orgId={params.orgId} />
              {access.has('org:write') && this.removeButton(member)}
            </StyledMemberContainer>
          ))
        ) : (
          <EmptyMessage icon="icon-user" size="large">
            {t('Your Team is Empty')}
          </EmptyMessage>
        )}
      </Panel>
    );
  },
});

const StyledMemberContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.borderLight};
`;

const StyledUserListElement = styled('div')`
  font-size: 0.875em;
  display: flex;
  align-items: center;
  padding: ${space(0.5)};
`;

const StyledNameOrEmail = styled('div')`
  flex-shrink: 1;
  min-width: 0;
  ${overflowEllipsis};
`;

const StyledAvatar = styled(props => <Avatar {...props} />)`
  min-width: 1.75em;
  min-height: 1.75em;
  width: 1.5em;
  height: 1.5em;
  margin-right: ${space(0.5)};
`;

const StyledMembersLabel = styled('div')`
  width: 250px;
  font-size: 0.875em;
  padding: ${space(1)} 0;
  text-transform: uppercase;
`;

const StyledCreateMemberLink = styled(Link)`
  float: right;
  text-transform: none;
`;

export default TeamMembers;
