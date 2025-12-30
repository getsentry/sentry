import {Fragment, useState} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import TextField from 'sentry/components/forms/fields/textField';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {User} from 'sentry/types/user';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type Props = ModalRenderProps & {
  onAction: (data: any) => void;
  userId: string;
};

function MergeAccountsModal(props: Props) {
  const {userId, onAction, closeModal, Header, Body, Footer} = props;
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  const makeMergeAccountsQueryKey = (): ApiQueryKey => [
    `/users/${userId}/merge-accounts/`,
  ];

  const {
    data: fetchedMergeAccounts,
    isPending,
    isError,
    refetch,
  } = useApiQuery<{users: User[]}>(makeMergeAccountsQueryKey(), {staleTime: 0});

  const mergeAccounts = fetchedMergeAccounts ?? {users: []};

  const fetchUserByUsername = async (username: string) => {
    try {
      const encodedUsername = encodeURIComponent(username);
      const data = await api.requestPromise(
        `/users/${userId}/merge-accounts/?username=${encodedUsername}`
      );
      setApiQueryData(
        queryClient,
        makeMergeAccountsQueryKey(),
        (prev: {users: User[]} | undefined) => {
          const users = prev?.users || [];
          return {
            ...prev,
            users: [...users, data.user],
          };
        }
      );
    } catch {
      setError(true);
    }
  };

  const doMergeMutation = useMutation({
    mutationFn: async () => {
      const userIds = selectedUserIds;
      addLoadingMessage();
      await api.requestPromise(`/users/${userId}/merge-accounts/`, {
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

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const addUsername: FormProps['onSubmit'] = data => {
    fetchUserByUsername(data.username);
  };

  const selectUser = (newUserId: string) =>
    setSelectedUserIds(prevSelectedUserIds =>
      prevSelectedUserIds.includes(newUserId)
        ? prevSelectedUserIds.filter(i => i !== newUserId)
        : [...prevSelectedUserIds, newUserId]
    );

  const renderUsernames = () => {
    return mergeAccounts.users.map((user, key) => (
      <label key={key} style={{display: 'block', width: 200, marginBottom: 10}}>
        <input
          type="checkbox"
          name="user"
          value={user.id}
          onChange={() => selectUser(user.id)}
          style={{margin: 5}}
        />
        {user.username}
      </label>
    ));
  };

  return (
    <Fragment>
      <Header> Merge Accounts </Header>
      <Body>
        <h5>Listed accounts will be merged into this user.</h5>
        <div>{renderUsernames()}</div>
        <Form onSubmit={addUsername} hideFooter>
          {error && (
            <Alert.Container>
              <Alert variant="danger" showIcon={false}>
                Could not find user(s)
              </Alert>
            </Alert.Container>
          )}
          <TextField
            label="Add another username:"
            name="username"
            placeholder="username"
          />
        </Form>
      </Body>
      <Footer>
        <Button onClick={() => doMergeMutation.mutate()} priority="primary">
          Merge Account(s)
        </Button>
      </Footer>
    </Fragment>
  );
}

export default MergeAccountsModal;
