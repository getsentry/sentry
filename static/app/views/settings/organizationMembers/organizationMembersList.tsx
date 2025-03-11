import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {resendMemberInvite} from 'sentry/actionCreators/members';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {redirectToRemainingOrganization} from 'sentry/actionCreators/organizations';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {Hovercard} from 'sentry/components/hovercard';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SearchBar from 'sentry/components/searchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {ORG_ROLES} from 'sentry/constants';
import {IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {OrganizationAuthProvider} from 'sentry/types/auth';
import type {Member} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import InviteBanner from 'sentry/views/settings/organizationMembers/inviteBanner';

import MembersFilter from './components/membersFilter';
import InviteRequestRow from './inviteRequestRow';
import OrganizationMemberRow from './organizationMemberRow';

const MemberListHeader = HookOrDefault({
  hookName: 'component:member-list-header',
  defaultComponent: () => <PanelHeader>{t('Active Members')}</PanelHeader>,
});

const InviteMembersButtonHook = HookOrDefault({
  hookName: 'member-invite-button:customization',
  defaultComponent: ({children, organization, onTriggerModal}) => {
    const isSsoRequired = organization.requiresSso;
    const disabled = isSsoRequired || !organization.features.includes('invite-members');
    return children({disabled, isSsoRequired, onTriggerModal});
  },
});

const getMembersQueryKey = ({
  orgSlug,
  query,
}: {
  orgSlug: string;
  query: Record<string, string>;
}): ApiQueryKey => [`/organizations/${orgSlug}/members/`, {query}];

const getInviteRequestsQueryKey = ({organization}: any): ApiQueryKey => [
  `/organizations/${organization.slug}/invite-requests/`,
];

function OrganizationMembersList() {
  const queryClient = useQueryClient();
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const {data: inviteRequests = [], refetch: refetchInviteRequests} = useApiQuery<
    Member[]
  >(getInviteRequestsQueryKey({organization}), {staleTime: 0});
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
    getMembersQueryKey({
      orgSlug: organization.slug,
      query: {
        query: location.query.query as string,
        cursor: location.query.cursor as string,
      },
    }),
    {staleTime: 0}
  );
  const [invited, setInvited] = useState<{
    [memberId: string]: 'loading' | 'success' | null;
  }>({});

  const removeMember = async (id: string) => {
    await api.requestPromise(`/organizations/${organization.slug}/members/${id}/`, {
      method: 'DELETE',
      data: {},
    });

    setApiQueryData<Member[]>(
      queryClient,
      getMembersQueryKey({
        orgSlug: organization.slug,
        query: {
          query: location.query.query as string,
          cursor: location.query.cursor as string,
        },
      }),
      currentMembers => currentMembers?.filter(member => member.id !== id)
    );
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
    try {
      await removeMember(id);
    } catch {
      addErrorMessage(tct('Error leaving [orgName]', {orgName: organization.slug}));
      return;
    }

    redirectToRemainingOrganization({
      navigate,
      orgId: organization.slug,
      removeOrg: true,
    });
    addSuccessMessage(tct('You left [orgName]', {orgName: organization.slug}));
  };

  const handleSendInvite = async ({id, expired}: any) => {
    setInvited(state => ({...state, [id]: 'loading'}));

    try {
      await resendMemberInvite(api, {
        orgId: organization.slug,
        memberId: id,
        regenerate: expired,
      });
    } catch {
      setInvited(state => ({...state, [id]: null}));
      addErrorMessage(t('Error sending invite'));
      return;
    }

    setInvited(state => ({...state, [id]: 'success'}));
  };

  const updateInviteRequest = (id: string, data: Partial<Member>) => {
    setApiQueryData<Member[]>(
      queryClient,
      getInviteRequestsQueryKey({organization}),
      currentInviteRequests => {
        return currentInviteRequests?.map(request => {
          if (request.id === id) {
            return {...request, ...data};
          }

          return request;
        });
      }
    );
  };

  const removeInviteRequest = (id: string) => {
    setApiQueryData<Member[]>(
      queryClient,
      getInviteRequestsQueryKey({organization}),
      curentInviteRequests => curentInviteRequests?.filter(request => request.id !== id)
    );
  };

  const handleInviteRequestAction = async ({
    inviteRequest,
    method,
    data,
    successMessage,
    errorMessage,
    eventKey,
  }: any) => {
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
    navigate({
      pathname: location.pathname,
      query: {...location.query, query, cursor: undefined},
    });
  };

  const canAddMembers = organization.access.includes('member:write');
  const canRemove = organization.access.includes('member:admin');
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

  // hides other users in demo mode
  const membersToShow = isDemoModeEnabled()
    ? members.filter(({email}) => email === currentUser.email)
    : members;

  const action = (
    <InviteMembersButtonHook
      organization={organization}
      onTriggerModal={() => {
        openInviteMembersModal({
          onClose: () => {
            refetchInviteRequests();
            refetchMembers();
          },
          source: 'members_settings',
        });
      }}
    >
      {({disabled, isSsoRequired, onTriggerModal}) => (
        <InviteMembersButton
          disabled={disabled}
          isSsoRequired={isSsoRequired}
          onTriggerModal={onTriggerModal}
        />
      )}
    </InviteMembersButtonHook>
  );

  return (
    <Fragment>
      <SettingsPageHeader title="Members" action={action} />
      <InviteBanner
        onSendInvite={() => {
          refetchMembers();
        }}
        onModalClose={() => {
          refetchInviteRequests();
          refetchMembers();
        }}
        allowedRoles={currentMember?.orgRoleList ?? currentMember?.roles ?? ORG_ROLES}
      />
      {inviteRequests.length > 0 && (
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
                allRoles={currentMember?.orgRoleList ?? currentMember?.roles ?? ORG_ROLES}
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
          roles={currentMember?.orgRoleList ?? currentMember?.roles ?? ORG_ROLES}
          query={searchQuery}
          onChange={handleQueryChange}
        />
        <SearchBar
          placeholder={t('Search Members')}
          query={searchQuery}
          onSearch={handleQueryChange}
        />
      </SearchWrapperWithFilter>
      <Panel data-test-id="org-member-list">
        <MemberListHeader members={membersToShow} organization={organization} />
        <PanelBody>
          {isLoadingMembers ? (
            <LoadingIndicator />
          ) : (
            <Fragment>
              {membersToShow.map(member => (
                <OrganizationMemberRow
                  key={member.id}
                  organization={organization}
                  member={member}
                  status={invited[member.id]!}
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
              {membersToShow.length === 0 && (
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

const SearchWrapperWithFilter = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1.5)};
  margin-bottom: ${space(1.5)};
`;

const StyledPanelItem = styled('div')`
  display: grid;
  grid-template-columns: minmax(150px, auto) minmax(100px, 140px) 420px;
  gap: ${space(2)};
  align-items: center;
  width: 100%;
`;

export default OrganizationMembersList;

function InviteMembersButton({
  disabled,
  isSsoRequired,
  onTriggerModal,
}: {
  onTriggerModal: () => void;
  disabled?: boolean;
  isSsoRequired?: boolean;
}) {
  const action = (
    <Button
      priority="primary"
      size="sm"
      onClick={onTriggerModal}
      data-test-id="email-invite"
      icon={<IconMail />}
      disabled={disabled}
    >
      {t('Invite Members')}
    </Button>
  );

  return disabled ? (
    isSsoRequired ? (
      <Tooltip
        skipWrapper
        title={t(
          `Your organization must use its single sign-on provider to register new members.`
        )}
      >
        {action}
      </Tooltip>
    ) : (
      <Hovercard
        body={
          <FeatureDisabled
            featureName={t('Invite Members')}
            features="organizations:invite-members"
            hideHelpToggle
          />
        }
      >
        {action}
      </Hovercard>
    )
  ) : (
    action
  );
}
