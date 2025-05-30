import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {openConfirmModal} from 'sentry/components/confirm';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ConfigStore from 'sentry/stores/configStore';
import type {UserIdentityConfig} from 'sentry/types/auth';
import {UserIdentityCategory, UserIdentityStatus} from 'sentry/types/auth';
import type {InternalAppApiToken, User} from 'sentry/types/user';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

import DetailsPage from 'admin/components/detailsPage';
import MergeAccountsModal from 'admin/components/mergeAccounts';
import SelectableContainer from 'admin/components/selectableContainer';
import UserCustomers from 'admin/components/users/userCustomers';
import UserEmailLog from 'admin/components/users/userEmailLog';
import UserEmails from 'admin/components/users/userEmails';
import UserOverview from 'admin/components/users/userOverview';
import UserPermissionsModal from 'admin/components/users/userPermissionsModal';

function UserDetails() {
  const api = useApi({persistInFlight: true});
  const {userId} = useParams<{userId: string}>();
  const queryClient = useQueryClient();

  const makeFetchUserQueryKey = (): ApiQueryKey => [`/users/${userId}/`];
  const makeFetchUserIdentitiesQueryKey = (): ApiQueryKey => [
    `/users/${userId}/user-identities/`,
  ];
  const makeFetchTokensQueryKey = (): ApiQueryKey => [`/api-tokens/`, {query: {userId}}];

  const {
    data: user,
    isPending: isUserPending,
    isError: isUserError,
    refetch: refetchUser,
  } = useApiQuery<User>(makeFetchUserQueryKey(), {staleTime: 0});

  const {
    data: identities,
    isPending: isIdentitiesPending,
    isError: isIdentitiesError,
    refetch: refetchIdentities,
  } = useApiQuery<UserIdentityConfig[]>(makeFetchUserIdentitiesQueryKey(), {
    staleTime: 0,
  });

  const {
    data: tokens,
    isPending: isTokensPending,
    isError: isTokensError,
    refetch: refetchTokens,
  } = useApiQuery<InternalAppApiToken[]>(makeFetchTokensQueryKey(), {
    staleTime: 0,
  });

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
      addLoadingMessage('Saving changes...');
    },
    onSuccess: (data, params) => {
      clearIndicators();
      addSuccessMessage(`User account has been updated with ${JSON.stringify(params)}`);
      setApiQueryData(queryClient, makeFetchUserQueryKey(), data);
    },
    onError: () => {
      addErrorMessage('There was an internal error with updating the user account.');
      clearIndicators();
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
      addSuccessMessage('Token has been revoked.');
      const newTokens = tokens?.filter((tkn: any) => tkn.id !== token.id) ?? [];
      setApiQueryData(queryClient, makeFetchTokensQueryKey(), newTokens);
    },
    onError: () => {
      addErrorMessage('Unable to revoke token.');
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
      ? addErrorMessage('An error occurred while merging users')
      : addSuccessMessage('Usernames have been merged');

  const onAuthenticatorRemove = (auth: NonNullable<User['authenticators']>[number]) => {
    const endpoint = `/users/${userId}/authenticators/${auth.id}/`;

    openConfirmModal({
      message: 'Are you sure you want to remove this authenticator?',
      onConfirm: () => {
        api.request(endpoint, {
          method: 'DELETE',
          success: () => {
            addSuccessMessage('Authenticator has been removed.');
            const authenticators =
              user?.authenticators?.filter(a => a.id !== auth.id) ?? [];
            setApiQueryData(queryClient, makeFetchUserQueryKey(), {
              ...user,
              authenticators,
            });
          },
          error: () => {
            addErrorMessage('Unable to remove authenticator from account.');
          },
        });
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
      onConfirm: () => {
        api.request(endpoint, {
          method: 'DELETE',
          success: () => {
            addSuccessMessage('Identity has been disconnected.');
            const newIdentities =
              identities?.filter(
                i => i.id !== identity.id || i.category !== identity.category
              ) ?? [];
            setApiQueryData(
              queryClient,
              makeFetchUserIdentitiesQueryKey(),
              newIdentities
            );
          },
          error: () => {
            addErrorMessage('Unable to remove identity from account.');
          },
        });
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
      badges={[{name: 'Inactive', level: 'warning', visible: !user.isActive}]}
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
                  setApiQueryData(queryClient, makeFetchUserQueryKey(), newUser);
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
          visible: !user.isActive,
          onAction: () => onUpdateMutation.mutate({isActive: 1}),
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

export default UserDetails;
