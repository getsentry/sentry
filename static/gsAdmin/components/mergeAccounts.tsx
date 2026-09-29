import {useState} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {useMutation, useQuery} from '@tanstack/react-query';

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
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchInput, {wait: 300});

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
  const {data: searchedUsers = [], isFetching: isSearching} = useQuery({
    ...apiOptions.as<User[]>()('/users/', {
      query: {query: debouncedSearch, per_page: 10},
      staleTime: 30_000,
    }),
    enabled: debouncedSearch.trim().length > 0,
  });

  const doMergeMutation = useMutation({
    mutationFn: (userIds: string[]) => {
      addLoadingMessage();
      return fetchMutation({
        url: endpoint,
        method: 'POST',
        data: {users: userIds},
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
    defaultValues: {users: [] as User[]},
    onSubmit: ({value}) =>
      doMergeMutation.mutateAsync(value.users.map(user => user.id)).catch(() => {}),
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <mergeForm.AppForm form={mergeForm}>
      <Header closeButton>
        <Heading as="h4">Merge Accounts</Heading>
      </Header>
      <Body>
        <Stack gap="sm">
          <Text as="p">Selected accounts will be merged into this user.</Text>
          <mergeForm.AppField name="users">
            {field => {
              const users = [
                ...mergeAccounts.users,
                ...searchedUsers,
                ...field.state.value,
              ].filter(
                (user, index, allUsers) =>
                  allUsers.findIndex(candidate => candidate.id === user.id) === index &&
                  user.id !== userId
              );
              return (
                <field.Layout.Stack label="Accounts to merge">
                  <field.Select
                    multiple
                    isSearchable
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={users.map(user => ({value: user, label: user.username}))}
                    isValueEqual={(a, b) => a.id === b.id}
                    isLoading={isSearching}
                    placeholder="Search users"
                    onInputChange={(value, action) => {
                      if (action.action === 'input-change') {
                        setSearchInput(value);
                      }
                    }}
                  />
                </field.Layout.Stack>
              );
            }}
          </mergeForm.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex justify="end">
          <mergeForm.SubmitButton>Merge Account(s)</mergeForm.SubmitButton>
        </Flex>
      </Footer>
    </mergeForm.AppForm>
  );
}
