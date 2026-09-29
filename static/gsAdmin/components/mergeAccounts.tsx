import {useState} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

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

const mergeSchema = z.object({
  users: z.array(z.custom<User>()).min(1, 'Select at least one account'),
});

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
  const {
    data: searchedUsers = [],
    isFetching: isSearching,
    isError: isSearchError,
  } = useQuery({
    ...apiOptions.as<User[]>()('/users/', {
      query: {query: debouncedSearch, per_page: 10},
      staleTime: 30_000,
    }),
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

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {users: [] as User[]},
    validators: {onDynamic: mergeSchema},
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
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">Merge Accounts</Heading>
      </Header>
      <Body>
        <Stack gap="sm">
          <Text as="p">Selected accounts will be merged into this user.</Text>
          <form.AppField name="users">
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
                    isLoading={searchInput !== debouncedSearch || isSearching}
                    filterOption={null}
                    placeholder="Search users"
                    noOptionsMessage={() =>
                      isSearchError
                        ? 'Unable to search users'
                        : searchInput
                          ? 'No matching users'
                          : 'No users available'
                    }
                    onInputChange={(value, action) => {
                      if (action.action === 'input-change') {
                        setSearchInput(value);
                      }
                    }}
                  />
                </field.Layout.Stack>
              );
            }}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex justify="end">
          <form.SubmitButton>Merge Account(s)</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
