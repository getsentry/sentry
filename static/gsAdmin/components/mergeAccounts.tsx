import {Fragment, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

type Props = ModalRenderProps & {
  onAction: (data: any) => void;
  userId: string;
};

export function MergeAccountsModal(props: Props) {
  const {userId, onAction, closeModal, Header, Body, Footer} = props;
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
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

  const lookupMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await queryClient.fetchQuery(
        apiOptions.as<{user: User}>()('/users/$userId/merge-accounts/', {
          path: {userId},
          query: {username},
          staleTime: 0,
        })
      );
      return response.json;
    },
    onSuccess: ({user}) => {
      queryClient.setQueryData(accountsQueryOptions.queryKey, previous => ({
        json: {users: [...(previous?.json.users ?? []), user]},
        headers: previous?.headers ?? {},
      }));
    },
  });

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

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {username: ''},
    onSubmit: ({value}) => lookupMutation.mutateAsync(value.username).catch(() => {}),
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
          <Stack gap="sm">
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
          <form.AppForm form={form}>
            {lookupMutation.isError && (
              <Alert.Container>
                <Alert variant="danger" showIcon={false}>
                  Could not find user(s)
                </Alert>
              </Alert.Container>
            )}
            <form.AppField name="username">
              {field => (
                <field.Layout.Stack label="Add another username:">
                  <field.Input
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder="username"
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
          </form.AppForm>
        </Stack>
      </Body>
      <Footer>
        <Button
          onClick={() => doMergeMutation.mutate()}
          variant="primary"
          disabled={doMergeMutation.isPending}
        >
          Merge Account(s)
        </Button>
      </Footer>
    </Fragment>
  );
}
