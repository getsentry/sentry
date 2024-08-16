import {Fragment, useState} from 'react';
import {browserHistory} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import {set} from 'lodash';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {resendMemberInvite} from 'sentry/actionCreators/members';
import {redirectToRemainingOrganization} from 'sentry/actionCreators/organizations';
import AsyncComponentSearchInput from 'sentry/components/asyncComponentSearchInput';
import EmptyMessage from 'sentry/components/emptyMessage';
import HookOrDefault from 'sentry/components/hookOrDefault';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SearchBar from 'sentry/components/searchBar';
import {ORG_ROLES} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {OrganizationAuthProvider} from 'sentry/types/auth';
import type {
  BaseRole,
  Member,
  MissingMember,
  Organization,
} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import theme from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {RenderSearch} from 'sentry/views/settings/components/defaultSearchBar';
import {SearchWrapper} from 'sentry/views/settings/components/defaultSearchBar';
import InviteBanner from 'sentry/views/settings/organizationMembers/inviteBanner';

import MembersFilter from './components/membersFilter';
import InviteRequestRow from './inviteRequestRow';
import OrganizationMemberRow from './organizationMemberRow';

const MemberListHeader = HookOrDefault({
  hookName: 'component:member-list-header',
  defaultComponent: () => <PanelHeader>{t('Active Members')}</PanelHeader>,
});

/**
 * Rewriting the class OrganizationMembersList to a function component
 */
function OrganizationMembersList() {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const location = useLocation();
  const {data: inviteRequests = [], refetch: refetchInviteRequests} = useApiQuery<
    Member[]
  >([`/organizations/${organization.slug}/invite-requests/`], {staleTime: 0});
  const {data: authProvider} = useApiQuery<OrganizationAuthProvider>(
    [`/organizations/${organization.slug}/auth-provider/`],
    {staleTime: 0}
  );
  const {data: currentMember} = useApiQuery<Member>(
    [`/organizations/${organization.slug}/members/me/`],
    {staleTime: 0}
  );
  const {
    data: members = [],
    isLoading: isLoadingMembers,
    refetch: refetchMembers,
    getResponseHeader,
  } = useApiQuery<Member[]>(
    [`/organizations/${organization.slug}/members/`, {query: location.query}],
    {staleTime: 0}
  );
  const [invited, setInvited] = useState<{[key: string]: 'loading' | 'success' | null}>(
    {}
  );

  const fetchMembersList = async () => {
    try {
      const data = await api.requestPromise(
        `/organizations/${organization.slug}/members/`,
        {
          method: 'GET',
          data: {paginate: true},
        }
      );
      // this.setState({members: data});
    } catch {
      addErrorMessage(t('Error fetching members'));
    }
  };

  const removeMember = async (id: string) => {
    await api.requestPromise(`/organizations/${organization.slug}/members/${id}/`, {
      method: 'DELETE',
      data: {},
    });

    // this.setState(state => ({
    //   members: state.members.filter(({id: existingId}) => existingId !== id),
    // }));
  };

  const handleRemove = async ({id, name}: Member) => {
    const {slug: orgName} = organization;

    try {
      await removeMember(id);
    } catch {
      addErrorMessage(tct('Error removing [name] from [orgName]', {name, orgName}));
      return;
    }

    addSuccessMessage(tct('Removed [name] from [orgName]', {name, orgName}));
  };

  const handleLeave = async ({id}: Member) => {
    const {slug: orgName} = organization;

    try {
      await removeMember(id);
    } catch {
      addErrorMessage(tct('Error leaving [orgName]', {orgName}));
      return;
    }

    redirectToRemainingOrganization({orgId: orgName, removeOrg: true});
    addSuccessMessage(tct('You left [orgName]', {orgName}));
  };

  const handleSendInvite = async ({id, expired}) => {
    // this.setState(state => ({
    //   invited: {...state.invited, [id]: 'loading'},
    // }));

    try {
      await resendMemberInvite(api, {
        orgId: organization.slug,
        memberId: id,
        regenerate: expired,
      });
    } catch {
      // this.setState(state => ({invited: {...state.invited, [id]: null}}));
      addErrorMessage(t('Error sending invite'));
      return;
    }

    // this.setState(state => ({invited: {...state.invited, [id]: 'success'}}));
  };

  const updateInviteRequest = (id: string, data: Partial<Member>) => {
    // this.setState(state => {
    //   const inviteRequests = [...state.inviteRequests];
    //   const inviteIndex = inviteRequests.findIndex(request => request.id === id);
    //   inviteRequests[inviteIndex] = {...inviteRequests[inviteIndex], ...data};
    //   return {inviteRequests};
    // });
  };

  const removeInviteRequest = (id: string) => {
    // this.setState(state => ({
    //   inviteRequests: state.inviteRequests.filter(request => request.id !== id),
    // }));
  };

  const handleInviteRequestAction = async ({
    inviteRequest,
    method,
    data,
    successMessage,
    errorMessage,
    eventKey,
  }) => {
    // this.setState(state => ({
    //   inviteRequestBusy: {...state.inviteRequestBusy, [inviteRequest.id]: true},
    // }));

    try {
      await api.requestPromise(
        `/organizations/${organization.slug}/invite-requests/${inviteRequest.id}/`,
        {
          method,
          data,
        }
      );

      removeInviteRequest(inviteRequest.id);
      addSuccessMessage(successMessage);
      trackAnalytics(eventKey, {
        member_id: parseInt(inviteRequest.id, 10),
        invite_status: inviteRequest.inviteStatus,
        organization,
      });
    } catch {
      addErrorMessage(errorMessage);
    }

    // this.setState(state => ({
    //   inviteRequestBusy: {...state.inviteRequestBusy, [inviteRequest.id]: false},
    // }));
  };

  const handleInviteRequestApprove = (inviteRequest: Member) => {
    handleInviteRequestAction({
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

  const handleInviteRequestDeny = (inviteRequest: Member) => {
    handleInviteRequestAction({
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

  const handleQueryChange = (query: string) => {
    browserHistory.replace({
      pathname: location.pathname,
      query: {...location.query, query},
    });
  };

  const title = routeTitleGen(t('Members'), organization.slug, false);

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
  const requireLink = !!authProvider && authProvider.require_link;

  const searchQuery = (location.query.query as string) || '';

  const membersPageLinks = getResponseHeader?.('Link');

  return (
    <Fragment>
      <InviteBanner
        onSendInvite={fetchMembersList}
        onModalClose={() => {
          refetchInviteRequests();
          refetchMembers();
        }}
        allowedRoles={currentMember ? currentMember.roles : ORG_ROLES}
      />
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
                onApprove={handleInviteRequestApprove}
                onDeny={handleInviteRequestDeny}
                onUpdate={data => updateInviteRequest(inviteRequest.id, data)}
              />
            ))}
          </PanelBody>
        </Panel>
      )}
      <SearchWrapperWithFilter>
        <MembersFilter
          roles={currentMember?.roles ?? ORG_ROLES}
          query={searchQuery}
          onChange={handleQueryChange}
        />
        <SearchBar
          placeholder={t('Search members')}
          query={searchQuery}
          onSearch={handleQueryChange}
        />
      </SearchWrapperWithFilter>
      <Panel data-test-id="org-member-list">
        <MemberListHeader members={members} organization={organization} />
        <PanelBody>
          {isLoadingMembers ? (
            <LoadingIndicator />
          ) : (
            <Fragment>
              {members.map(member => (
                <OrganizationMemberRow
                  key={member.id}
                  organization={organization}
                  member={member}
                  status={invited[member.id]}
                  memberCanLeave={
                    !(
                      isOnlyOwner ||
                      member.flags['idp:provisioned'] ||
                      member.flags['partnership:restricted']
                    )
                  }
                  currentUser={currentUser}
                  canRemoveMembers={canRemove}
                  canAddMembers={canAddMembers}
                  requireLink={requireLink}
                  onSendInvite={handleSendInvite}
                  onRemove={handleRemove}
                  onLeave={handleLeave}
                />
              ))}
              {members.length === 0 && (
                <EmptyMessage>{t('No members found.')}</EmptyMessage>
              )}
            </Fragment>
          )}
        </PanelBody>
      </Panel>

      <Pagination pageLinks={membersPageLinks} />
    </Fragment>
  );
}

const SearchWrapperWithFilter = styled(SearchWrapper)`
  display: grid;
  grid-template-columns: max-content 1fr;
  margin-top: 0;
`;

const StyledPanelItem = styled('div')`
  display: grid;
  grid-template-columns: minmax(150px, auto) minmax(100px, 140px) 420px;
  gap: ${space(2)};
  align-items: center;
  width: 100%;
`;

export default OrganizationMembersList;
