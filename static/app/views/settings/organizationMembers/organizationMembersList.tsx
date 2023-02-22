import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {resendMemberInvite} from 'sentry/actionCreators/members';
import {redirectToRemainingOrganization} from 'sentry/actionCreators/organizations';
import {Button} from 'sentry/components/button';
import DeprecatedDropdownMenu from 'sentry/components/deprecatedDropdownMenu';
import EmptyMessage from 'sentry/components/emptyMessage';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {ORG_ROLES} from 'sentry/constants';
import {IconSliders} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Member, MemberRole, Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import routeTitleGen from 'sentry/utils/routeTitle';
import theme from 'sentry/utils/theme';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import {
  RenderSearch,
  SearchWrapper,
} from 'sentry/views/settings/components/defaultSearchBar';

import MembersFilter from './components/membersFilter';
import InviteRequestRow from './inviteRequestRow';
import OrganizationMemberRow from './organizationMemberRow';

type Props = {
  organization: Organization;
} & RouteComponentProps<{}, {}>;

type State = AsyncView['state'] & {
  inviteRequests: Member[];
  invited: {[key: string]: 'loading' | 'success' | null};
  member: (Member & {roles: MemberRole[]}) | null;
  members: Member[];
};

const MemberListHeader = HookOrDefault({
  hookName: 'component:member-list-header',
  defaultComponent: () => <PanelHeader>{t('Active Members')}</PanelHeader>,
});

class OrganizationMembersList extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      members: [],
      invited: {},
    };
  }

  onLoadAllEndpointsSuccess() {
    const {organization} = this.props;
    const {inviteRequests, members} = this.state;
    trackAdvancedAnalyticsEvent('member_settings_page.loaded', {
      organization,
      num_members: members?.length,
      num_invite_requests: inviteRequests?.length,
    });
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization} = this.props;

    return [
      ['members', `/organizations/${organization.slug}/members/`, {}, {paginate: true}],
      [
        'member',
        `/organizations/${organization.slug}/members/me/`,
        {},
        {allowError: error => error.status === 404},
      ],
      [
        'authProvider',
        `/organizations/${organization.slug}/auth-provider/`,
        {},
        {allowError: error => error.status === 403},
      ],

      ['inviteRequests', `/organizations/${organization.slug}/invite-requests/`],
    ];
  }

  getTitle() {
    const orgId = this.props.organization.slug;
    return routeTitleGen(t('Members'), orgId, false);
  }

  removeMember = async (id: string) => {
    const {organization} = this.props;

    await this.api.requestPromise(`/organizations/${organization.slug}/members/${id}/`, {
      method: 'DELETE',
      data: {},
    });

    this.setState(state => ({
      members: state.members.filter(({id: existingId}) => existingId !== id),
    }));
  };

  handleRemove = async ({id, name}: Member) => {
    const {organization} = this.props;
    const {slug: orgName} = organization;

    try {
      await this.removeMember(id);
    } catch {
      addErrorMessage(tct('Error removing [name] from [orgName]', {name, orgName}));
      return;
    }

    addSuccessMessage(tct('Removed [name] from [orgName]', {name, orgName}));
  };

  handleLeave = async ({id}: Member) => {
    const {organization} = this.props;
    const {slug: orgName} = organization;

    try {
      await this.removeMember(id);
    } catch {
      addErrorMessage(tct('Error leaving [orgName]', {orgName}));
      return;
    }

    redirectToRemainingOrganization({orgId: orgName, removeOrg: true});
    addSuccessMessage(tct('You left [orgName]', {orgName}));
  };

  handleSendInvite = async ({id, expired}) => {
    this.setState(state => ({
      invited: {...state.invited, [id]: 'loading'},
    }));
    const {organization} = this.props;

    try {
      await resendMemberInvite(this.api, {
        orgId: organization.slug,
        memberId: id,
        regenerate: expired,
      });
    } catch {
      this.setState(state => ({invited: {...state.invited, [id]: null}}));
      addErrorMessage(t('Error sending invite'));
      return;
    }

    this.setState(state => ({invited: {...state.invited, [id]: 'success'}}));
  };

  updateInviteRequest = (id: string, data: Partial<Member>) =>
    this.setState(state => {
      const inviteRequests = [...state.inviteRequests];
      const inviteIndex = inviteRequests.findIndex(request => request.id === id);

      inviteRequests[inviteIndex] = {...inviteRequests[inviteIndex], ...data};

      return {inviteRequests};
    });

  removeInviteRequest = (id: string) =>
    this.setState(state => ({
      inviteRequests: state.inviteRequests.filter(request => request.id !== id),
    }));

  handleInviteRequestAction = async ({
    inviteRequest,
    method,
    data,
    successMessage,
    errorMessage,
    eventKey,
  }) => {
    const {organization} = this.props;

    this.setState(state => ({
      inviteRequestBusy: {...state.inviteRequestBusy, [inviteRequest.id]: true},
    }));

    try {
      await this.api.requestPromise(
        `/organizations/${organization.slug}/invite-requests/${inviteRequest.id}/`,
        {
          method,
          data,
        }
      );

      this.removeInviteRequest(inviteRequest.id);
      addSuccessMessage(successMessage);
      trackAdvancedAnalyticsEvent(eventKey, {
        member_id: parseInt(inviteRequest.id, 10),
        invite_status: inviteRequest.inviteStatus,
        organization,
      });
    } catch {
      addErrorMessage(errorMessage);
    }

    this.setState(state => ({
      inviteRequestBusy: {...state.inviteRequestBusy, [inviteRequest.id]: false},
    }));
  };

  handleInviteRequestApprove = (inviteRequest: Member) => {
    this.handleInviteRequestAction({
      inviteRequest,
      method: 'PUT',
      data: {
        role: inviteRequest.role,
        teams: inviteRequest.teams,
        approve: 1,
      },
      successMessage: tct('[email] has been invited', {email: inviteRequest.email}),
      errorMessage: tct('Error inviting [email]', {email: inviteRequest.email}),
      eventKey: 'invite_request.approved',
    });
  };

  handleInviteRequestDeny = (inviteRequest: Member) => {
    this.handleInviteRequestAction({
      inviteRequest,
      method: 'DELETE',
      data: {},
      successMessage: tct('Invite request for [email] denied', {
        email: inviteRequest.email,
      }),
      errorMessage: tct('Error denying invite request for [email]', {
        email: inviteRequest.email,
      }),
      eventKey: 'invite_request.denied',
    });
  };

  renderBody() {
    const {organization} = this.props;
    const {membersPageLinks, members, member: currentMember, inviteRequests} = this.state;
    const {access} = organization;

    const canAddMembers = access.includes('member:write');
    const canRemove = access.includes('member:admin');
    const currentUser = ConfigStore.get('user');

    // Find out if current user is the only owner
    const isOnlyOwner = !members.find(
      ({role, email, pending}) =>
        role === 'owner' && email !== currentUser.email && !pending
    );

    // Only admins/owners can remove members
    const requireLink = !!this.state.authProvider && this.state.authProvider.require_link;

    // eslint-disable-next-line react/prop-types
    const renderSearch: RenderSearch = ({defaultSearchBar, value, handleChange}) => (
      <SearchWrapperWithFilter>
        <DeprecatedDropdownMenu closeOnEscape>
          {({getActorProps, isOpen}) => (
            <FilterWrapper>
              <Button icon={<IconSliders size="xs" />} {...getActorProps({})}>
                {t('Filter')}
              </Button>
              {isOpen && (
                <StyledMembersFilter
                  roles={currentMember?.roles ?? ORG_ROLES}
                  query={value}
                  onChange={(query: string) => handleChange(query)}
                />
              )}
            </FilterWrapper>
          )}
        </DeprecatedDropdownMenu>
        {defaultSearchBar}
      </SearchWrapperWithFilter>
    );

    return (
      <Fragment>
        <ClassNames>
          {({css}) =>
            this.renderSearchInput({
              updateRoute: true,
              placeholder: t('Search Members'),
              children: renderSearch,
              className: css`
                font-size: ${theme.fontSizeMedium};
              `,
            })
          }
        </ClassNames>
        {inviteRequests && inviteRequests.length > 0 && (
          <Panel>
            <PanelHeader>
              <StyledPanelItem>
                <div>{t('Pending Members')}</div>
                <div>{t('Role')}</div>
                <div>{t('Teams')}</div>
              </StyledPanelItem>
            </PanelHeader>
            <PanelBody>
              {inviteRequests.map(inviteRequest => (
                <InviteRequestRow
                  key={inviteRequest.id}
                  organization={organization}
                  inviteRequest={inviteRequest}
                  inviteRequestBusy={{}}
                  allRoles={currentMember?.roles ?? ORG_ROLES}
                  onApprove={this.handleInviteRequestApprove}
                  onDeny={this.handleInviteRequestDeny}
                  onUpdate={data => this.updateInviteRequest(inviteRequest.id, data)}
                />
              ))}
            </PanelBody>
          </Panel>
        )}
        <Panel data-test-id="org-member-list">
          <MemberListHeader members={members} organization={organization} />
          <PanelBody>
            {members.map(member => (
              <OrganizationMemberRow
                key={member.id}
                organization={organization}
                member={member}
                status={this.state.invited[member.id]}
                memberCanLeave={!isOnlyOwner && !member.flags['idp:provisioned']}
                currentUser={currentUser}
                canRemoveMembers={canRemove}
                canAddMembers={canAddMembers}
                requireLink={requireLink}
                onSendInvite={this.handleSendInvite}
                onRemove={this.handleRemove}
                onLeave={this.handleLeave}
              />
            ))}
            {members.length === 0 && (
              <EmptyMessage>{t('No members found.')}</EmptyMessage>
            )}
          </PanelBody>
        </Panel>

        <Pagination pageLinks={membersPageLinks} />
      </Fragment>
    );
  }
}

const SearchWrapperWithFilter = styled(SearchWrapper)`
  display: grid;
  grid-template-columns: max-content 1fr;
  margin-top: 0;
`;

const FilterWrapper = styled('div')`
  position: relative;
`;

const StyledMembersFilter = styled(MembersFilter)`
  position: absolute;
  right: 0;
  top: 42px;
  z-index: ${p => p.theme.zIndex.dropdown};

  &:before,
  &:after {
    position: absolute;
    top: -16px;
    right: 32px;
    content: '';
    height: 16px;
    width: 16px;
    border: 8px solid transparent;
    border-bottom-color: ${p => p.theme.backgroundSecondary};
  }

  &:before {
    margin-top: -1px;
    border-bottom-color: ${p => p.theme.border};
  }
`;

const StyledPanelItem = styled('div')`
  display: grid;
  grid-template-columns: minmax(150px, auto) minmax(100px, 140px) 420px;
  gap: ${space(2)};
  align-items: center;
  width: 100%;
`;

export default withOrganization(OrganizationMembersList);
