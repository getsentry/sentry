import {useMutation, useQueryClient, useQuery} from '@tanstack/react-query';

import {openConfirmModal} from '@sentry/scraps/confirm';
import {useModal} from '@sentry/scraps/modal';
import {toast} from '@sentry/scraps/toast';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ConfigStore} from 'sentry/stores/configStore';
import type {UserIdentityConfig} from 'sentry/types/auth';
import {UserIdentityCategory, UserIdentityStatus} from 'sentry/types/auth';
import type {InternalAppApiToken, User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

import {DetailsPage} from 'admin/components/detailsPage';
import {MergeAccountsModal} from 'admin/components/mergeAccounts';
import {SelectableContainer} from 'admin/components/selectableContainer';
import {UserCustomers} from 'admin/components/users/userCustomers';
import {UserEmailLog} from 'admin/components/users/userEmailLog';
import {UserEmails} from 'admin/components/users/userEmails';
import {UserOverview} from 'admin/components/users/userOverview';
import {UserPermissionsModal} from 'admin/components/users/userPermissionsModal';

export function UserDetails() {
  const {openModal} = useModal();

  const api = useApi({persistInFlight: true});
  const {userId} = useParams<{userId: string}>();
  const queryClient = useQueryClient();

  const userQueryOptions = apiOptions.as<User>()('/users/$userId/', {
    path: {userId},
    staleTime: 0,
  });

  const {
    data: user,
    isPending: isUserPending,
    isError: isUserError,
    refetch: refetchUser,
  } = useQuery(userQueryOptions);

  const identitiesQueryOptions = apiOptions.as<UserIdentityConfig[]>()(
    '/users/$userId/user-identities/',
    {path: {userId}, staleTime: 0}
  );

  const {
    data: identities,
    isPending: isIdentitiesPending,
    isError: isIdentitiesError,
    refetch: refetchIdentities,
  } = useQuery(identitiesQueryOptions);

  const tokensQueryOptions = apiOptions.as<InternalAppApiToken[]>()('/api-tokens/', {
    query: {userId},
    staleTime: 0,
  });

  const {
    data: tokens,
    isPending: isTokensPending,
    isError: isTokensError,
    refetch: refetchTokens,
  } = useQuery(tokensQueryOptions);

  const refetchData = () => {
    refetchUser();
    refetchIdentities();
    refetchTokens();
  };

  const onUpdateMutation = useMutation({
    mutationFn: (params: Record<string, any>) => {
      return api.requestPromise(`/users/${userId}/`, {
        method: 'PUT',
        data: params,
      });
    },
    onMutate: () => {
      toast.loading('Saving changes...');
    },
    onSuccess: (data, params) => {
      toast.dismiss();
      toast.success(`User account has been updated with ${JSON.stringify(params)}`);
      queryClient.setQueryData(userQueryOptions.queryKey, previous =>
        data === undefined
          ? previous
          : {
              ...previous,
              headers: previous?.headers ?? {},
              json: data,
            }
      );
    },
    onError: () => {
      toast.error('There was an internal error with updating the user account.');
      toast.dismiss();
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: (token: InternalAppApiToken) => {
      return api.requestPromise('/api-tokens/', {
        method: 'DELETE',
        data: {userId, tokenId: token.id},
      });
    },
    onSuccess: (_data, token) => {
      toast.success('Token has been revoked.');
      const newTokens = tokens?.filter(tkn => tkn.id !== token.id) ?? [];
      queryClient.setQueryData(tokensQueryOptions.queryKey, previous => ({
        ...previous,
        headers: previous?.headers ?? {},
        json: newTokens,
      }));
    },
    onError: () => {
      toast.error('Unable to revoke token.');
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (params: Record<string, any>) =>
      fetchMutation({
        url: getApiUrl('/_admin/users/$userId/suspend/', {path: {userId}}),
        method: 'POST',
        data: params,
      }),
    onMutate: () => {
      toast.loading('Saving changes...');
    },
    onSuccess: (_data, params) => {
      toast.dismiss();
      const action = params.action === 'suspend' ? 'suspended' : 'unsuspended';
      toast.success(`User account has been ${action}.`);
      queryClient.invalidateQueries({queryKey: userQueryOptions.queryKey});
    },
    onError: () => {
      toast.dismiss();
      toast.error('Failed to update user suspension status.');
    },
  });

  if (isUserPending || isIdentitiesPending || isTokensPending) {
    return <LoadingIndicator />;
  }

  if (isUserError || isIdentitiesError || isTokensError) {
    return <LoadingError onRetry={refetchData} />;
  }

  const onMergeAccounts = ({error = null}) =>
    error
      ? toast.error('An error occurred while merging users')
      : toast.success('Usernames have been merged');

  const onAuthenticatorRemove = (auth: NonNullable<User['authenticators']>[number]) => {
    const endpoint = `/users/${userId}/authenticators/${auth.id}/`;

    openConfirmModal({
      message: 'Are you sure you want to remove this authenticator?',
      onConfirm: async () => {
        try {
          await api.requestPromise(endpoint, {
            method: 'DELETE',
            includeAllArgs: true,
          });
          toast.success('Authenticator has been removed.');
          const authenticators =
            user?.authenticators?.filter(a => a.id !== auth.id) ?? [];
          queryClient.setQueryData(userQueryOptions.queryKey, previous => ({
            ...previous,
            headers: previous?.headers ?? {},
            json: {
              ...user,
              authenticators,
            },
          }));
        } catch {
          toast.error('Unable to remove authenticator from account.');
        }
      },
    });
  };

  const onIdentityDisconnect = (identity: UserIdentityConfig) => {
    const usesConfigEndpoint = identity.status === UserIdentityStatus.CAN_DISCONNECT;
    if (!usesConfigEndpoint && identity.category !== UserIdentityCategory.ORG_IDENTITY) {
      throw new Error('Identity is not eligible for deletion.'); // button should not be rendered
    }

    const endpoint = usesConfigEndpoint
      ? `/users/${userId}/user-identities/${identity.category}/${identity.id}/`
      : `/users/${userId}/identities/${identity.id}/`;

    openConfirmModal({
      message:
        'Are you sure you want to disconnect this identity?' +
        (identity.status === UserIdentityStatus.NEEDED_FOR_GLOBAL_AUTH
          ? ' (Caution: User may be locked out of platform login.)'
          : '') +
        (identity.status === UserIdentityStatus.NEEDED_FOR_ORG_AUTH
          ? ' (Caution: User may be locked out of org access.)'
          : ''),
      onConfirm: async () => {
        try {
          await api.requestPromise(endpoint, {
            method: 'DELETE',
            includeAllArgs: true,
          });
          toast.success('Identity has been disconnected.');
          const newIdentities =
            identities?.filter(
              i => i.id !== identity.id || i.category !== identity.category
            ) ?? [];
          queryClient.setQueryData(identitiesQueryOptions.queryKey, previous => ({
            ...previous,
            headers: previous?.headers ?? {},
            json: newIdentities,
          }));
        } catch {
          toast.error('Unable to remove identity from account.');
        }
      },
    });
  };

  if (user === null) {
    return null;
  }

  const emailSections: React.ComponentProps<typeof SelectableContainer>['sections'] = [
    {
      key: 'emails',
      name: 'Addresses',
      content: ({Panel}) => <UserEmails Panel={Panel} user={user} />,
    },
    {
      key: 'log',
      name: 'Log',
      content: ({Panel}) => <UserEmailLog Panel={Panel} user={user} />,
    },
  ];

  const userEmails = (
    <SelectableContainer
      dropdownPrefix="Emails"
      panelTitle="User Emails"
      sections={emailSections}
    />
  );

  return (
    <DetailsPage
      rootName="Users"
      name={user.name === user.email ? user.email : `${user.name} (${user.email})`}
      badges={[
        {name: 'Inactive', level: 'warning', visible: !user.isActive},
        {name: 'Suspended', level: 'danger', visible: user.isSuspended},
      ]}
      actions={[
        {
          key: 'edit-permissions',
          name: 'Edit Permissions',
          help: 'Configure _admin permissions.',
          skipConfirmModal: true,
          disabled: !ConfigStore.get('user').permissions.has('users.admin'),
          onAction: () => {
            openModal(deps => (
              <UserPermissionsModal
                {...deps}
                user={user}
                onSubmit={(newUser: User) => {
                  queryClient.setQueryData(userQueryOptions.queryKey, previous => ({
                    ...previous,
                    headers: previous?.headers ?? {},
                    json: newUser,
                  }));
                }}
              />
            ));
          },
        },
        {
          key: 'mergeAccounts',
          name: 'Merge Accounts',
          help: 'Merge two or more user accounts',
          visible: user.isActive,
          skipConfirmModal: true,
          onAction: () =>
            openModal(deps => (
              <MergeAccountsModal {...deps} userId={user.id} onAction={onMergeAccounts} />
            )),
        },
        {
          key: 'reactivate',
          name: 'Reactivate Account',
          help: 'Restores this account allowing the user to login.',
          visible: !user.isActive && !user.isSuspended,
          onAction: () => onUpdateMutation.mutate({isActive: 1}),
        },
        {
          key: 'suspend',
          name: 'Suspend Account',
          help: 'Prevent this user from logging in. Account and data are preserved.',
          visible: user.isActive && !user.isSuspended,
          confirmModalOpts: {
            priority: 'danger',
            confirmText: 'Suspend Account',
          },
          onAction: params => suspendMutation.mutate({...params, action: 'suspend'}),
        },
        {
          key: 'unsuspend',
          name: 'Unsuspend Account',
          help: 'Allow this user to log in again.',
          visible: user.isSuspended,
          onAction: params => suspendMutation.mutate({...params, action: 'unsuspend'}),
        },
      ]}
      sections={[
        {
          content: (
            <UserOverview
              user={user}
              tokens={tokens}
              identities={identities || []}
              onAuthenticatorRemove={onAuthenticatorRemove}
              onIdentityDisconnect={onIdentityDisconnect}
              revokeToken={revokeTokenMutation.mutate}
            />
          ),
        },
        {
          noPanel: true,
          content: <UserCustomers userId={user.id} />,
        },
        {
          noPanel: true,
          content: userEmails,
        },
      ]}
    />
  );
}
