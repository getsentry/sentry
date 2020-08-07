import React from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {IconUser, IconSubtract} from 'app/icons';
import {Organization, Team, Member, Config} from 'app/types';
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
import LoadingIndicator from 'app/components/loadingIndicator';

import {joinTheTeam, leaveTheTeam} from '../utils';

type Props = AsyncComponent['props'] & {
  api: Client;
  team: Team;
  members: Array<Member>;
  organization: Organization;
  canWrite: boolean;
  config: Config;
  onUpdateMembers: (newMembers: Array<Member>) => void;
};

type State = AsyncComponent['state'] & {
  orgMemberList: Array<Member>;
  isDropdownBusy: boolean;
  query: string;
};

class Members extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      orgMembersList: [],
      isDropdownBusy: false,
      query: '',
    };
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.query !== this.state.query) {
      this.fetchData();
    }

    if (!isEqual(prevState.orgMembersList, this.state.orgMemberList)) {
      this.setDropDownStatus();
    }
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

  handleRemoveMember = (memberId: Member['id']) => () => {
    const {api, members, team: teamToLeave, organization, onUpdateMembers} = this.props;

    leaveTheTeam({
      api,
      teamToLeave,
      organization,
      memberId,
      onSubmitSuccess: () => {
        const newMembers = members.filter(member => member.id !== memberId);
        onUpdateMembers(newMembers);
      },
    });
  };

  handleAddTeamMember = (memberId: Member['id']) => {
    const {api, organization, team: teamToJoin, onUpdateMembers, members} = this.props;
    const {orgMembersList} = this.state;

    // Reset members list after adding member to team
    this.debouncedFetchMembersRequest('');

    joinTheTeam({
      api,
      type: 'member',
      teamToJoin,
      organization,
      onSubmitSuccess: () => {
        const memberData = orgMembersList.find(orgMember => orgMember.id === memberId);

        if (!memberData) {
          return;
        }

        const newMembers = [...members, memberData];
        onUpdateMembers(newMembers);
      },
    });
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
    const {organization, canWrite, team, members} = this.props;
    const {isDropdownBusy, orgMembersList} = this.state;

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
                  teamId: team.slug,
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
          <DropdownButton isOpen={isOpen} size="small" icon={<IconUser />}>
            {t('Add Member')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  };

  renderContent() {
    const {canWrite, organization, config, members} = this.props;
    const {loading} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (members.length === 0) {
      return (
        <EmptyMessage icon={<IconUser size="xl" />} size="large">
          {t('This team has no members')}
        </EmptyMessage>
      );
    }

    return members.map(member => {
      const isSelf = member.email === config.user.email;
      return (
        <StyledPanelItem key={member.id}>
          <IdBadge avatarSize={36} member={member} useLink orgId={organization.slug} />
          {(canWrite || isSelf) && (
            <Button
              size="small"
              icon={<IconSubtract size="xs" isCircled />}
              onClick={this.handleRemoveMember(member.id)}
              label={t('Remove')}
            >
              {t('Remove')}
            </Button>
          )}
        </StyledPanelItem>
      );
    });
  }

  render() {
    return (
      <Panel>
        <PanelHeader hasButtons>
          {t('Members')}
          <DropDownWrapper>{this.renderDropdown()}</DropDownWrapper>
        </PanelHeader>
        <PanelBody>{this.renderContent()}</PanelBody>
      </Panel>
    );
  }
}

export default withApi(withConfig(Members));

const DropDownWrapper = styled('div')`
  text-transform: none;
`;

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
