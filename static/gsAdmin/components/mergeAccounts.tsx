import {Fragment, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconAdd} from 'sentry/icons';
import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

import {AdminSearchCombobox} from 'admin/components/adminSearchCombobox';

type Props = ModalRenderProps & {
  onAction: (data: any) => void;
  userId: string;
};

export function MergeAccountsModal(props: Props) {
  const {userId, onAction, closeModal, Header, Body, Footer} = props;
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const queryClient = useQueryClient();

  const endpoint = getApiUrl('/users/$userId/merge-accounts/', {
    path: {userId},
  });
  const accountsQueryOptions = apiOptions.as<{users: User[]}>()(
    '/users/$userId/merge-accounts/',
    {path: {userId}, staleTime: 0}
  );

  const {
    data: fetchedMergeAccounts,
    isPending,
    isError,
    refetch,
  } = useQuery(accountsQueryOptions);

  const mergeAccounts = fetchedMergeAccounts ?? {users: []};

  const addAccount = (user: User) => {
    queryClient.setQueryData(accountsQueryOptions.queryKey, previous => {
      const users = previous?.json.users ?? [];
      return {
        json: {
          users: users.some(account => account.id === user.id) ? users : [...users, user],
        },
        headers: previous?.headers ?? {},
      };
    });
    setIsAddingUser(false);
  };

  const doMergeMutation = useMutation({
    mutationFn: () => {
      addLoadingMessage();
      return fetchMutation({
        url: endpoint,
        method: 'POST',
        data: {users: selectedUserIds},
      });
    },
    onSuccess: () => {
      clearIndicators();
      closeModal();
      onAction({});
    },
    onError: err => {
      clearIndicators();
      onAction({error: err});
    },
  });

  const mergeForm = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {},
    onSubmit: () => doMergeMutation.mutateAsync().catch(() => {}),
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const selectUser = (newUserId: string) =>
    setSelectedUserIds(prevSelectedUserIds =>
      prevSelectedUserIds.includes(newUserId)
        ? prevSelectedUserIds.filter(i => i !== newUserId)
        : [...prevSelectedUserIds, newUserId]
    );

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">Merge Accounts</Heading>
      </Header>
      <Body>
        <Stack gap="sm">
          <Text as="p">Listed accounts will be merged into this user.</Text>
          <Stack gap="md">
            {mergeAccounts.users.map(user => (
              <Flex as="label" key={user.id} align="center" gap="sm">
                <Checkbox
                  name="user"
                  value={user.id}
                  checked={selectedUserIds.includes(user.id)}
                  onChange={() => selectUser(user.id)}
                />
                <Text as="span">{user.username}</Text>
              </Flex>
            ))}
          </Stack>
          {isAddingUser ? (
            <AdminSearchCombobox
              label="Search users"
              getResultKey={user => user.id}
              getResultSearchTerms={user => [user.username, user.email, user.name]}
              onSelectResult={addAccount}
              queryOptions={query =>
                apiOptions.as<User[]>()('/users/', {
                  query: {query, per_page: 10},
                  staleTime: 30_000,
                })
              }
              renderResult={user => user.username}
            />
          ) : (
            <Flex>
              <Button icon={<IconAdd />} onClick={() => setIsAddingUser(true)}>
                Add another user
              </Button>
            </Flex>
          )}
        </Stack>
      </Body>
      <Footer>
        <mergeForm.AppForm form={mergeForm}>
          <Flex justify="end">
            <mergeForm.SubmitButton>Merge Account(s)</mergeForm.SubmitButton>
          </Flex>
        </mergeForm.AppForm>
      </Footer>
    </Fragment>
  );
}
