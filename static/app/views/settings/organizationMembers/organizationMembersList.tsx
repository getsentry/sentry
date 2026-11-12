import {Fragment, useMemo, useState} from 'react';
import {IconMail} from '@sentry/icons/mail';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {parseAsString, useQueryStates} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {toast} from '@sentry/scraps/toast';
import {Tooltip} from '@sentry/scraps/tooltip';

import {resendMemberInvite} from 'sentry/actionCreators/members';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {redirectToRemainingOrganization} from 'sentry/actionCreators/organizations';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {Hovercard} from 'sentry/components/hovercard';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {SearchBar} from 'sentry/components/searchBar';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {ORG_ROLES} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {OrganizationAuthProvider} from 'sentry/types/auth';
import type {Member, Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {getPaginationProps} from 'sentry/utils/pagination';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {MembersFilter} from './components/membersFilter';
import {InviteBanner} from './inviteBanner';
import {InviteRequestRow} from './inviteRequestRow';
import {OrganizationMemberRow} from './organizationMemberRow';

const MemberListHeader = OverrideOrDefault({
  overrideName: 'component:member-list-header',
  defaultComponent: () => null,
});

const MEMBER_COLUMNS: TableColumnConfig[] = [
  {key: 'member', width: 'minmax(150px, 1fr)'},
  {key: 'role', width: 'max-content'},
  {key: 'status', width: 'max-content'},
  {key: 'actions', width: 'max-content'},
];

const INVITE_REQUEST_COLUMNS: TableColumnConfig[] = [
  {key: 'member', width: 'minmax(150px, 2fr)'},
  {key: 'role', width: 'minmax(170px, 1fr)'},
  {key: 'teams', width: 'minmax(170px, 1.5fr)'},
  {key: 'actions', width: 'max-content'},
];

const InviteMembersButtonHook = OverrideOrDefault({
  overrideName: 'member-invite-button:customization',
  defaultComponent: ({children, organization, onTriggerModal}) => {
    const isSsoRequired = organization.requiresSso;
    const disabled = isSsoRequired || !organization.features.includes('invite-members');
    return children({disabled, isSsoRequired, onTriggerModal});
  },
});

function membersApiOptions({
  orgSlug,
  query,
}: {
  orgSlug: string;
  query?: Partial<Record<'query' | 'cursor', unknown>>;
}) {
  return apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/members/', {
    path: {organizationIdOrSlug: orgSlug},
    query,
    staleTime: 0,
  });
}

const inviteRequestsOptions = ({organization}: {organization: Organization}) =>
  apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/invite-requests/', {
    path: {organizationIdOrSlug: organization.slug},
    staleTime: 0,
  });

function OrganizationMembersList() {
  const queryClient = useQueryClient();
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const navigate = useNavigate();
  const [{query, cursor}, setQueryParams] = useQueryStates({
    query: parseAsString,
    cursor: parseAsString,
  });
  const {data: inviteRequests = [], refetch: refetchInviteRequests} = useQuery(
    inviteRequestsOptions({organization})
  );
  const {data: authProvider} = useQuery(
    apiOptions.as<OrganizationAuthProvider>()(
      '/organizations/$organizationIdOrSlug/auth-provider/',
      {path: {organizationIdOrSlug: organization.slug}, staleTime: 0}
    )
  );
  const {data: currentMember} = useQuery(
    apiOptions.as<Member>()('/organizations/$organizationIdOrSlug/members/$memberId/', {
      path: {organizationIdOrSlug: organization.slug, memberId: 'me'},
      staleTime: 30000,
    })
  );
  const membersQueryOptions = membersApiOptions({
    orgSlug: organization.slug,
    query: {
      query: query ?? undefined,
      cursor: cursor ?? undefined,
    },
  });
  const {
    data: membersResponse,
    isPending: isPendingMembers,
    refetch: refetchMembers,
  } = useQuery({
    ...membersQueryOptions,
    select: selectJsonWithHeaders,
  });
  const members = useMemo(() => membersResponse?.json ?? [], [membersResponse?.json]);
  const {data: activeOwnerMembers = [], isPending: isPendingOwners} = useQuery({
    ...membersApiOptions({
      orgSlug: organization.slug,
      // Ignore search queries since this isn't displayed, it's okay not to paginate.
      // This is only used to determine if the current user is the only owner.
      // We also filter out active invites, so only active users are included.
      query: {query: 'role:owner isInvited:false'},
    }),
    staleTime: 30_000,
  });

  const [invited, setInvited] = useState<Record<string, 'loading' | 'success' | null>>(
    {}
  );

  const removeMember = async (id: string) => {
    await api.requestPromise(
      getApiUrl('/organizations/$organizationIdOrSlug/members/$memberId/', {
        path: {organizationIdOrSlug: organization.slug, memberId: id},
      }),
      {
        method: 'DELETE',
        data: {},
      }
    );

    queryClient.setQueryData(membersQueryOptions.queryKey, prevData =>
      prevData
        ? {
            ...prevData,
            json: prevData.json.filter(member => member.id !== id),
          }
        : prevData
    );
  };

  const handleRemove = async ({id, name}: Member) => {
    const {slug: orgName} = organization;

    try {
      await removeMember(id);
    } catch {
      toast.error(tct('Error removing [name] from [orgName]', {name, orgName}));
      return;
    }

    toast.success(tct('Removed [name] from [orgName]', {name, orgName}));
  };

  const handleLeave = async ({id}: Member) => {
    try {
      await removeMember(id);
    } catch {
      toast.error(tct('Error leaving [orgName]', {orgName: organization.slug}));
      return;
    }

    redirectToRemainingOrganization({
      navigate,
      orgId: organization.slug,
      removeOrg: true,
    });
    toast.success(tct('You left [orgName]', {orgName: organization.slug}));
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
      toast.error(t('Error sending invite'));
      return;
    }

    setInvited(state => ({...state, [id]: 'success'}));
  };

  const updateInviteRequest = (id: string, data: Partial<Member>) => {
    queryClient.setQueryData(inviteRequestsOptions({organization}).queryKey, oldData => {
      if (!oldData) {
        return oldData;
      }

      return {
        ...oldData,
        json: oldData.json.map(request =>
          request.id === id ? {...request, ...data} : request
        ),
      };
    });
  };

  const removeInviteRequest = (id: string) => {
    queryClient.setQueryData(inviteRequestsOptions({organization}).queryKey, oldData =>
      oldData
        ? {...oldData, json: oldData.json.filter(request => request.id !== id)}
        : oldData
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
        getApiUrl('/organizations/$organizationIdOrSlug/invite-requests/$memberId/', {
          path: {organizationIdOrSlug: organization.slug, memberId: inviteRequest.id},
        }),
        {
          method,
          data,
        }
      );

      removeInviteRequest(inviteRequest.id);
      toast.success(successMessage);
      trackAnalytics(eventKey, {
        member_id: parseInt(inviteRequest.id, 10),
        invite_status: inviteRequest.inviteStatus,
        organization,
      });
    } catch {
      toast.error(errorMessage);
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

  const handleQueryChange = (newQuery: string) => {
    setQueryParams({query: newQuery, cursor: null}, {history: 'push'});
  };

  const canAddMembers = organization.access.includes('member:write');
  const canRemove = organization.access.includes('member:admin');
  const currentUser = ConfigStore.get('user');

  // Find out if current user is the only owner
  // Filter to members with valid users (user_id set and user exists)
  // Members with user: null during eventual consistency window are excluded
  const isOnlyOwner = !activeOwnerMembers
    .filter(member => member.user !== null)
    .some(member => member.email !== currentUser.email);

  // Only admins/owners can remove members
  const requireLink = !!authProvider && authProvider.require_link;

  const searchQuery = query ?? '';

  const membersPageLinks = membersResponse?.headers.Link;

  // hides other users in demo mode
  const membersToShow = useMemo(
    () =>
      isDemoModeActive()
        ? members.filter(Boolean).filter(({email}) => email === currentUser.email)
        : members.filter(Boolean),
    [members, currentUser.email]
  );

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
      <SettingsPageHeader title="Members" />
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
      <Stack gap="lg">
        {!isDemoModeActive() && inviteRequests.length > 0 && (
          <SimpleTable
            aria-label={t('Pending Members')}
            columns={INVITE_REQUEST_COLUMNS}
            scrollable
            header={
              <SimpleTable.HeaderRow>
                <SimpleTable.HeaderCell>{t('Pending Members')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Role')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Teams')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell aria-label={t('Actions')} />
              </SimpleTable.HeaderRow>
            }
          >
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
          </SimpleTable>
        )}
        <Flex align="center" gap="lg">
          <MembersFilter
            roles={currentMember?.orgRoleList ?? currentMember?.roles ?? ORG_ROLES}
            query={searchQuery}
            onChange={handleQueryChange}
          />
          <Container flex={1}>
            {containerProps => (
              <SearchBar
                {...containerProps}
                placeholder={t('Search Members')}
                query={searchQuery}
                onSearch={handleQueryChange}
              />
            )}
          </Container>
          {action}
        </Flex>
        <SimpleTable
          aria-label={t('Members')}
          columns={MEMBER_COLUMNS}
          data-test-id="org-member-list"
          scrollable
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>{t('Members')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Role')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell aria-label={t('Actions')} />
            </SimpleTable.HeaderRow>
          }
        >
          <MemberListHeader members={membersToShow} organization={organization} />
          {isPendingMembers || isPendingOwners ? (
            <SimpleTable.Loading />
          ) : membersToShow.length === 0 ? (
            <SimpleTable.Empty>{t('No members found.')}</SimpleTable.Empty>
          ) : (
            membersToShow.map(member => (
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
            ))
          )}
        </SimpleTable>
      </Stack>

      <Pagination {...getPaginationProps(membersPageLinks)} />
    </Fragment>
  );
}

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
      variant="primary"
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
          'Your organization must use its single sign-on provider to register new members.'
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
