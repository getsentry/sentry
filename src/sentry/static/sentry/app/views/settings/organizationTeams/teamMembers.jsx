import PropTypes from 'prop-types';
import React from 'react';
import debounce from 'lodash/debounce';
import styled from '@emotion/styled';

import {Panel, PanelHeader} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {joinTeam, leaveTeam} from 'app/actionCreators/teams';
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
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes from 'app/sentryTypes';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withConfig from 'app/utils/withConfig';
import withOrganization from 'app/utils/withOrganization';

class TeamMembers extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    config: SentryTypes.Config.isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  state = {
    loading: true,
    error: false,
    dropdownBusy: false,
    teamMemberList: null,
    orgMemberList: null,
  };

  UNSAFE_componentWillMount() {
    this.fetchData();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const params = this.props.params;
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
  }

  debouncedFetchMembersRequest = debounce(function(query) {
    this.setState(
      {
        dropdownBusy: true,
      },
      () => this.fetchMembersRequest(query)
    );
  }, 200);

  removeMember(member) {
    const {params} = this.props;
    leaveTeam(
      this.props.api,
      {
        orgId: params.orgId,
        teamId: params.teamId,
        memberId: member.id,
      },
      {
        success: () => {
          this.setState({
            teamMemberList: this.state.teamMemberList.filter(m => m.id !== member.id),
          });
          addSuccessMessage(t('Successfully removed member from team.'));
        },
        error: () => {
          addErrorMessage(
            t('There was an error while trying to remove a member from the team.')
          );
        },
      }
    );
  }

  fetchMembersRequest = async query => {
    const {params, api} = this.props;
    const {orgId} = params;

    try {
      const data = await api.requestPromise(`/organizations/${orgId}/members/`, {
        query: {
          query,
        },
      });
      this.setState({
        orgMemberList: data,
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

  fetchData = async () => {
    const {api, params} = this.props;

    try {
      const data = await api.requestPromise(
        `/teams/${params.orgId}/${params.teamId}/members/`
      );
      this.setState({
        teamMemberList: data,
        loading: false,
        error: false,
      });
    } catch (err) {
      this.setState({
        loading: false,
        error: true,
        errorResponse: err,
      });
    }

    this.fetchMembersRequest('');
  };

  addTeamMember = selection => {
    const {params} = this.props;

    this.setState({
      loading: true,
    });

    // Reset members list after adding member to team
    this.debouncedFetchMembersRequest('');

    joinTeam(
      this.props.api,
      {
        orgId: params.orgId,
        teamId: params.teamId,
        memberId: selection.value,
      },
      {
        success: () => {
          const orgMember = this.state.orgMemberList.find(
            member => member.id === selection.value
          );
          this.setState({
            loading: false,
            error: false,
            teamMemberList: this.state.teamMemberList.concat([orgMember]),
          });
          addSuccessMessage(t('Successfully added member to team.'));
        },
        error: () => {
          this.setState({
            loading: false,
          });
          addErrorMessage(t('Unable to add team member.'));
        },
      }
    );
  };

  /**
   * We perform an API request to support orgs with > 100 members (since that's the max API returns)
   *
   * @param {Event} e React Event when member filter input changes
   */
  handleMemberFilterChange = e => {
    this.setState({dropdownBusy: true});
    this.debouncedFetchMembersRequest(e.target.value);
  };

  renderDropdown = access => {
    const {organization, params} = this.props;
    const existingMembers = new Set(this.state.teamMemberList.map(member => member.id));

    // members can add other members to a team if the `Open Membership` setting is enabled
    // otherwise, `org:write` or `team:admin` permissions are required
    const hasOpenMembership = organization && organization.openMembership;
    const hasWriteAccess = access.has('org:write') || access.has('team:admin');
    const canAddMembers = hasOpenMembership || hasWriteAccess;

    const items = (this.state.orgMemberList || [])
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
          onClick={() => openInviteMembersModal({source: 'teams'})}
          data-test-id="invite-member"
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
            ? this.addTeamMember
            : selection =>
                openTeamAccessRequestModal({
                  teamId: params.teamId,
                  orgId: params.orgId,
                  memberId: selection.value,
                })
        }
        menuHeader={menuHeader}
        emptyMessage={t('No members')}
        onChange={this.handleMemberFilterChange}
        busy={this.state.dropdownBusy}
        onClose={() => this.debouncedFetchMembersRequest('')}
      >
        {({isOpen}) => (
          <DropdownButton isOpen={isOpen} size="xsmall" data-test-id="add-member">
            {t('Add Member')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  };

  removeButton = member => (
    <Button
      size="small"
      onClick={this.removeMember.bind(this, member)}
      label={t('Remove')}
    >
      <InlineSvg
        src="icon-circle-subtract"
        size="1.25em"
        style={{marginRight: space(1)}}
      />
      {t('Remove')}
    </Button>
  );

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    const {params, organization, config} = this.props;
    const access = new Set(organization.access);
    const hasWriteAccess = access.has('org:write') || access.has('team:admin');

    return (
      <Panel>
        <PanelHeader hasButtons>
          <div>{t('Members')}</div>
          <div style={{textTransform: 'none'}}>{this.renderDropdown(access)}</div>
        </PanelHeader>
        {this.state.teamMemberList.length ? (
          this.state.teamMemberList.map(member => {
            const isSelf = member.email === config.user.email;
            const canRemoveMember = hasWriteAccess || isSelf;
            return (
              <StyledMemberContainer key={member.id}>
                <IdBadge avatarSize={36} member={member} useLink orgId={params.orgId} />
                {canRemoveMember && this.removeButton(member)}
              </StyledMemberContainer>
            );
          })
        ) : (
          <EmptyMessage icon="icon-user" size="large">
            {t('This team has no members')}
          </EmptyMessage>
        )}
      </Panel>
    );
  }
}

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

const StyledAvatar = styled(props => <UserAvatar {...props} />)`
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

export default withConfig(withApi(withOrganization(TeamMembers)));
