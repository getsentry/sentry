import React from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {IconUser, IconSubtract} from 'app/icons';
import {Organization, Team, Member, Config} from 'app/types';
import {leaveTeam, joinTeam} from 'app/actionCreators/teams';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import {
  openInviteMembersModal,
  openTeamAccessRequestModal,
} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import UserAvatar from 'app/components/avatar/userAvatar';
import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withConfig from 'app/utils/withConfig';

type Props = AsyncComponent['props'] & {
  api: Client;
  teamSlug: Team['slug'];
  members: Array<Member>;
  organization: Organization;
  canWrite: boolean;
  config: Config;
};

type State = AsyncComponent['state'] & {
  members: Array<Member>;
  orgMemberList: Array<Member>;
  isDropdownBusy: boolean;
  query: string;
};

class Members extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      orgMembersList: [],
      members: this.props.members || [],
      isDropdownBusy: false,
      query: '',
    };
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevState.query !== this.state.query) {
      this.fetchData();
    }
    if (prevProps.members.length === 0 && this.props.members.length > 0) {
      this.getMembers();
    }

    if (!isEqual(prevState.orgMembersList, this.state.orgMemberList)) {
      this.setDropDownStatus();
    }
  }

  getMembers() {
    this.setState({members: this.props.members});
  }

  getEndpoints = (): ReturnType<AsyncComponent['getEndpoints']> => {
    const {organization} = this.props;
    const {query} = this.state;

    return [
      [
        'orgMembersList',
        `/organizations/${organization.slug}/members/`,
        {query: {query}},
      ],
    ];
  };

  setDropDownStatus() {
    const {isDropdownBusy} = this.state;

    if (isDropdownBusy) {
      this.setState({isDropdownBusy: false});
    }
  }

  handleRemoveMember = (member: Member) => () => {
    const {api, teamSlug, organization} = this.props;

    leaveTeam(
      api,
      {
        orgId: organization.slug,
        teamId: teamSlug,
        memberId: member.id,
      },
      {
        success: () => {
          this.setState(prevState => ({
            members: prevState.members.filter(m => m.id !== member.id),
          }));
          addSuccessMessage(t('Successfully removed member from team.'));
        },
        error: () => {
          addErrorMessage(
            t('There was an error while trying to remove a member from the team.')
          );
        },
      }
    );
  };

  handleAddTeamMember = (memberId: Member['id']) => {
    const {organization, teamSlug} = this.props;
    const {orgMembersList} = this.state;

    // Reset members list after adding member to team
    this.debouncedFetchMembersRequest('');

    joinTeam(
      this.props.api,
      {
        orgId: organization.slug,
        teamId: teamSlug,
        memberId,
      },
      {
        success: () => {
          const memberData = orgMembersList.find(orgMember => orgMember.id === memberId);
          if (!memberData) {
            return;
          }

          this.setState(prevState => ({
            members: [...prevState.members, memberData],
          }));

          addSuccessMessage(t('Successfully added member in the team.'));
        },
        error: () => {
          addErrorMessage(
            t('There was an error while trying to add a member in the team.')
          );
        },
      }
    );
  };

  debouncedFetchMembersRequest = debounce(query => {
    this.setState({
      isDropdownBusy: true,
      query,
    });
  }, 200);

  handleMemberFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({isDropdownBusy: true});
    this.debouncedFetchMembersRequest(event.target.value);
  };

  renderDropdown = () => {
    const {organization, canWrite, teamSlug} = this.props;
    const {members, isDropdownBusy, orgMembersList} = this.state;

    const existingMembers = new Set(members.map(member => member.id));

    // members can add other members to a team if the `Open Membership` setting is enabled
    // otherwise, `org:write` or `team:admin` permissions are required
    const hasOpenMembership = organization && organization.openMembership;
    const canAddMembers = hasOpenMembership || canWrite;

    const items = orgMembersList
      .filter(m => !existingMembers.has(m.id))
      .map(m => ({
        searchKey: `${m.name} ${m.email}`,
        value: m.id,
        label: (
          <DropDownItem>
            <StyledAvatar user={m} size={24} className="avatar" />
            <StyledNameOrEmail>{m.name || m.email}</StyledNameOrEmail>
          </DropDownItem>
        ),
      }));

    const menuHeader = (
      <StyledMembersLabel>
        {t('Members')}
        <StyledCreateMemberLink
          to=""
          onClick={() => openInviteMembersModal({source: 'teams'})}
        >
          {t('Invite Member')}
        </StyledCreateMemberLink>
      </StyledMembersLabel>
    );

    return (
      <DropdownAutoComplete
        items={items}
        onSelect={
          canAddMembers
            ? (selection: {value: string}) => this.handleAddTeamMember(selection.value)
            : (selection: {value: string}) =>
                openTeamAccessRequestModal({
                  teamId: teamSlug,
                  orgId: organization.slug,
                  memberId: selection.value,
                })
        }
        menuHeader={menuHeader}
        emptyMessage={t('No members')}
        onChange={this.handleMemberFilterChange}
        busy={isDropdownBusy}
        onClose={() => this.debouncedFetchMembersRequest('')}
      >
        {({isOpen}) => (
          <DropdownButton isOpen={isOpen} size="xsmall">
            {t('Add Member')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  };

  render() {
    const {canWrite, organization, config} = this.props;
    const {members} = this.state;

    return (
      <Panel>
        <PanelHeader hasButtons>
          <div>{t('Members')}</div>
          <div style={{textTransform: 'none'}}>{this.renderDropdown()}</div>
        </PanelHeader>
        <PanelBody>
          {members.length ? (
            members.map(member => {
              const isSelf = member.email === config.user.email;
              return (
                <StyledPanelItem key={member.id}>
                  <IdBadge
                    avatarSize={36}
                    member={member}
                    useLink
                    orgId={organization.slug}
                  />
                  {(canWrite || isSelf) && (
                    <Button
                      size="small"
                      icon={<IconSubtract size="xs" isCircled />}
                      onClick={this.handleRemoveMember(member)}
                      label={t('Remove')}
                    >
                      {t('Remove')}
                    </Button>
                  )}
                </StyledPanelItem>
              );
            })
          ) : (
            <EmptyMessage icon={<IconUser size="xl" />} size="large">
              {t('This team has no members')}
            </EmptyMessage>
          )}
        </PanelBody>
      </Panel>
    );
  }
}

export default withApi(withConfig(Members));

const StyledPanelItem = styled(PanelItem)`
  justify-content: space-between;
  align-items: center;
`;

const DropDownItem = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(0.5)};
  align-items: center;
`;

const StyledNameOrEmail = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  ${overflowEllipsis};
`;

const StyledAvatar = styled(props => <UserAvatar {...props} />)`
  min-width: 1.75em;
  min-height: 1.75em;
  width: 1.5em;
  height: 1.5em;
`;

const StyledMembersLabel = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  padding: ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-transform: uppercase;
`;

const StyledCreateMemberLink = styled(Link)`
  text-transform: none;
`;
