import {queryOptions, useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {useScrapsForm, ScrapsForm, defaultFormValidators} from '@sentry/scraps/form';
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
const defaultValues: z.infer<typeof mergeSchema> = {users: []};

export function MergeAccountsModal(props: Props) {
  const {userId, onAction, closeModal, Header, Body, Footer} = props;
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
    defaultValues,
    validators: defaultFormValidators(mergeSchema),
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
    <ScrapsForm form={form}>
      <Header closeButton>
        <Heading as="h4">Merge Accounts</Heading>
      </Header>
      <Body>
        <Stack gap="sm">
          <Text as="p">Selected accounts will be merged into this user.</Text>
          <form.Field name="users">
            {field => (
              <field.Layout.Stack label="Accounts to merge">
                <field.SelectAsync
                  multiple
                  isSearchable
                  value={field.value}
                  onChange={field.handleChange}
                  queryOptions={search => {
                    const options = apiOptions.as<User[]>()('/users/', {
                      query: {query: search, per_page: 10},
                      staleTime: 0,
                    });
                    return queryOptions({
                      ...options,
                      select: ({json}) =>
                        [...mergeAccounts.users, ...json, ...field.value]
                          .filter(
                            (user, index, users) =>
                              users.findIndex(candidate => candidate.id === user.id) ===
                                index && user.id !== userId
                          )
                          .map(user => ({value: user, label: user.username})),
                    });
                  }}
                  isValueEqual={(a, b) => a.id === b.id}
                  filterOption={null}
                  placeholder="Search users"
                  noOptionsMessage={() => 'No users available'}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
        </Stack>
      </Body>
      <Footer>
        <Flex justify="end">
          <form.SubmitButton>Merge Account(s)</form.SubmitButton>
        </Flex>
      </Footer>
    </ScrapsForm>
  );
}
