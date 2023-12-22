import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  openInviteMembersModal,
  openTeamAccessRequestModal,
} from 'sentry/actionCreators/modal';
import {joinTeam, leaveTeam} from 'sentry/actionCreators/teams';
import {Client} from 'sentry/api';
import {hasEveryAccess} from 'sentry/components/acl/access';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import {Item} from 'sentry/components/dropdownAutoComplete/types';
import DropdownButton from 'sentry/components/dropdownButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {TeamRoleColumnLabel} from 'sentry/components/teamRoleUtils';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Config, Member, Organization, Team, TeamMember} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withConfig from 'sentry/utils/withConfig';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView, {AsyncViewState} from 'sentry/views/deprecatedAsyncView';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import TeamMembersRow, {
  GRID_TEMPLATE,
} from 'sentry/views/settings/organizationTeams/teamMembersRow';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

import {getButtonHelpText} from './utils';

type RouteParams = {
  teamId: string;
};

interface Props extends RouteComponentProps<RouteParams, {}> {
  api: Client;
  config: Config;
  organization: Organization;
  team: Team;
}

interface State extends AsyncViewState {
  dropdownBusy: boolean;
  error: boolean;
  orgMembers: Member[];
  teamMembers: TeamMember[];
}

class TeamMembers extends DeprecatedAsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      error: false,
      dropdownBusy: false,
      teamMembers: [],
      orgMembers: [],
    };
  }

  componentDidMount() {
    super.componentDidMount();
    // Initialize "add member" dropdown with data
    this.fetchMembersRequest('');
  }

  debouncedFetchMembersRequest = debounce(
    (query: string) =>
      this.setState({dropdownBusy: true}, () => this.fetchMembersRequest(query)),
    200
  );

  fetchMembersRequest = async (query: string) => {
    const {organization, api} = this.props;

    try {
      const data = await api.requestPromise(
        `/organizations/${organization.slug}/members/`,
        {
          query: {query},
        }
      );
      this.setState({
        orgMembers: data,
        dropdownBusy: false,
      });
    } catch (_err) {
      addErrorMessage(t('Unable to load organization members.'), {
        duration: 2000,
      });

      this.setState({
        dropdownBusy: false,
      });
    }
  };

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization, params} = this.props;

    return [
      [
        'teamMembers',
        `/teams/${organization.slug}/${params.teamId}/members/`,
        {},
        {paginate: true},
      ],
    ];
  }

  addTeamMember = (selection: Item) => {
    const {organization, params} = this.props;
    const {orgMembers, teamMembers} = this.state;

    // Reset members list after adding member to team
    this.debouncedFetchMembersRequest('');

    joinTeam(
      this.props.api,
      {
        orgId: organization.slug,
        teamId: params.teamId,
        memberId: selection.value,
      },
      {
        success: () => {
          const orgMember = orgMembers.find(member => member.id === selection.value);
          if (orgMember === undefined) {
            return;
          }
          this.setState({
            error: false,
            teamMembers: teamMembers.concat([orgMember as TeamMember]),
          });
          addSuccessMessage(t('Successfully added member to team.'));
        },
        error: () => {
          addErrorMessage(t('Unable to add team member.'));
        },
      }
    );
  };

  removeTeamMember = (member: Member) => {
    const {organization, params} = this.props;
    const {teamMembers} = this.state;
    leaveTeam(
      this.props.api,
      {
        orgId: organization.slug,
        teamId: params.teamId,
        memberId: member.id,
      },
      {
        success: () => {
          this.setState({
            teamMembers: teamMembers.filter(m => m.id !== member.id),
          });
          addSuccessMessage(t('Successfully removed member from team.'));
        },
        error: () =>
          addErrorMessage(
            t('There was an error while trying to remove a member from the team.')
          ),
      }
    );
  };

  updateTeamMemberRole = (member: Member, newRole: string) => {
    const {organization} = this.props;
    const {teamId} = this.props.params;
    const endpoint = `/organizations/${organization.slug}/members/${member.id}/teams/${teamId}/`;

    this.props.api.request(endpoint, {
      method: 'PUT',
      data: {teamRole: newRole},
      success: data => {
        const teamMembers: any = [...this.state.teamMembers];
        const i = teamMembers.findIndex(m => m.id === member.id);
        teamMembers[i] = {
          ...member,
          teamRole: data.teamRole,
        };
        this.setState({teamMembers});
        addSuccessMessage(t('Successfully changed role for team member.'));
      },
      error: () => {
        addErrorMessage(
          t('There was an error while trying to change the roles for a team member.')
        );
      },
    });
  };

  /**
   * We perform an API request to support orgs with > 100 members (since that's the max API returns)
   *
   * @param {Event} e React Event when member filter input changes
   */
  handleMemberFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({dropdownBusy: true});
    this.debouncedFetchMembersRequest(e.target.value);
  };

  renderDropdown(isTeamAdmin: boolean) {
    const {organization, params, team} = this.props;
    const {orgMembers} = this.state;
    const existingMembers = new Set(this.state.teamMembers.map(member => member.id));

    // members can add other members to a team if the `Open Membership` setting is enabled
    // otherwise, `org:write` or `team:admin` permissions are required
    const hasOpenMembership = !!organization?.openMembership;
    const canAddMembers = hasOpenMembership || isTeamAdmin;

    const isDropdownDisabled = team.flags['idp:provisioned'];

    const items = (orgMembers || [])
      .filter(m => !existingMembers.has(m.id))
      .map(m => ({
        searchKey: `${m.name} ${m.email}`,
        value: m.id,
        label: (
          <StyledUserListElement>
            <StyledAvatar user={m} size={24} className="avatar" />
            <StyledNameOrEmail>{m.name || m.email}</StyledNameOrEmail>
          </StyledUserListElement>
        ),
      }));

    const menuHeader = (
      <StyledMembersLabel>
        {t('Members')}
        <StyledCreateMemberLink
          to=""
          onClick={() => openInviteMembersModal({source: 'teams'})}
          data-test-id="invite-member"
        >
          {t('Invite Member')}
        </StyledCreateMemberLink>
      </StyledMembersLabel>
    );

    return (
      <DropdownAutoComplete
        closeOnSelect={false}
        items={items}
        alignMenu="right"
        onSelect={
          canAddMembers
            ? this.addTeamMember
            : selection =>
                openTeamAccessRequestModal({
                  teamId: params.teamId,
                  orgId: organization.slug,
                  memberId: selection.value,
                })
        }
        menuHeader={menuHeader}
        emptyMessage={t('No members')}
        onChange={this.handleMemberFilterChange}
        busy={this.state.dropdownBusy}
        onClose={() => this.debouncedFetchMembersRequest('')}
        disabled={isDropdownDisabled}
        data-test-id="add-member-menu"
      >
        {({isOpen}) => (
          <DropdownButton
            isOpen={isOpen}
            size="xs"
            data-test-id="add-member"
            disabled={isDropdownDisabled}
          >
            {t('Add Member')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  }

  renderPageTextBlock() {
    const {organization, team} = this.props;
    const {openMembership} = organization;
    const isIdpProvisioned = team.flags['idp:provisioned'];

    if (isIdpProvisioned) {
      return getButtonHelpText(isIdpProvisioned);
    }

    return openMembership
      ? t(
          '"Open Membership" is enabled for the organization. Anyone can add members for this team.'
        )
      : t(
          '"Open Membership" is disabled for the organization. Org Owner/Manager/Admin, or Team Admins can add members for this team.'
        );
  }

  renderMembers(isTeamAdmin: boolean) {
    const {config, organization, team} = this.props;
    const {access} = organization;

    // org:admin is a unique scope that only org owners have
    const isOrgOwner = access.includes('org:admin');
    const {teamMembers, loading} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }
    if (teamMembers.length) {
      return teamMembers.map(member => {
        return (
          <TeamMembersRow
            key={member.id}
            hasWriteAccess={isTeamAdmin}
            isOrgOwner={isOrgOwner}
            organization={organization}
            team={team}
            member={member}
            user={config.user}
            removeMember={this.removeTeamMember}
            updateMemberRole={this.updateTeamMemberRole}
          />
        );
      });
    }
    return (
      <EmptyMessage icon={<IconUser size="xl" />} size="large">
        {t('This team has no members')}
      </EmptyMessage>
    );
  }

  render() {
    if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    const {organization, team} = this.props;
    const {teamMembersPageLinks} = this.state;
    const {openMembership} = organization;

    const hasOrgWriteAccess = hasEveryAccess(['org:write'], {organization, team});
    const hasTeamAdminAccess = hasEveryAccess(['team:admin'], {organization, team});
    const isTeamAdmin = hasOrgWriteAccess || hasTeamAdminAccess;

    return (
      <Fragment>
        <TextBlock>{this.renderPageTextBlock()}</TextBlock>

        <PermissionAlert
          access={openMembership ? ['org:read'] : ['team:write']}
          team={team}
        />

        <Panel>
          <StyledPanelHeader hasButtons>
            <div>{t('Members')}</div>
            <div>
              <TeamRoleColumnLabel />
            </div>
            <div style={{textTransform: 'none'}}>{this.renderDropdown(isTeamAdmin)}</div>
          </StyledPanelHeader>
          {this.renderMembers(isTeamAdmin)}
        </Panel>
        <Pagination pageLinks={teamMembersPageLinks} />
      </Fragment>
    );
  }
}

const StyledUserListElement = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.5)};
  align-items: center;
`;

const StyledNameOrEmail = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  ${p => p.theme.overflowEllipsis};
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

const StyledPanelHeader = styled(PanelHeader)`
  ${GRID_TEMPLATE}
`;

export default withConfig(withApi(withOrganization(TeamMembers)));
