import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import type {JsonFormObject} from 'sentry/components/forms/types';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

const userEditForm: JsonFormObject = {
  title: 'User details',
  fields: [
    {
      name: 'name',
      type: 'string',
      required: true,
      label: t('Name'),
    },
    {
      name: 'username',
      type: 'string',
      required: true,
      label: t('Username'),
      help: t('The username is the unique id of the user in the system'),
    },
    {
      name: 'email',
      type: 'string',
      required: true,
      label: t('Email'),
      help: t('The users primary email address'),
    },
    {
      name: 'isActive',
      type: 'boolean',
      required: false,
      label: t('Active'),
      help: t(
        'Designates whether this user should be treated as active. Unselect this instead of deleting accounts.'
      ),
    },
    {
      name: 'isStaff',
      type: 'boolean',
      required: false,
      label: t('Admin'),
      help: t('Designates whether this user can perform administrative functions.'),
    },
    {
      name: 'isSuperuser',
      type: 'boolean',
      required: false,
      label: t('Superuser'),
      help: t(
        'Designates whether this user has all permissions without explicitly assigning them.'
      ),
    },
  ],
};

const REMOVE_BUTTON_LABEL = {
  disable: t('Disable User'),
  delete: t('Permanently Delete User'),
};

type DeleteType = 'disable' | 'delete';

type RemoveModalProps = ModalRenderProps & {
  onRemove: (type: DeleteType) => void;
  user: User;
};

function RemoveUserModal({user, onRemove, closeModal}: RemoveModalProps) {
  const [deleteType, setDeleteType] = useState<DeleteType>('disable');

  const handleRemove = () => {
    onRemove(deleteType);
    closeModal();
  };

  return (
    <Fragment>
      <RadioGroup
        value={deleteType}
        label={t('Remove user %s', user.email)}
        onChange={type => setDeleteType(type)}
        choices={[
          ['disable', t('Disable the account.')],
          ['delete', t('Permanently remove the user and their data.')],
        ]}
      />
      <ModalFooter>
        <Button priority="danger" onClick={handleRemove}>
          {REMOVE_BUTTON_LABEL[deleteType]}
        </Button>
        <Button onClick={closeModal}>{t('Cancel')}</Button>
      </ModalFooter>
    </Fragment>
  );
}

function AdminUserEdit() {
  const {id} = useParams<{id: string}>();
  const userEndpoint = `/users/${id}/`;
  const [formModel] = useState(() => new FormModel());
  const api = useApi({persistInFlight: true});
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: user,
    isPending,
    isError,
    refetch,
  } = useApiQuery<User>([userEndpoint], {
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      return api.requestPromise(userEndpoint, {
        method: 'DELETE',
        data: {hardDelete: true, organizations: []},
      });
    },
    onSuccess: () => {
      addSuccessMessage(t("%s's account has been deleted.", user?.email));
      navigate('/manage/users/', {replace: true});
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => {
      return api.requestPromise(userEndpoint, {
        method: 'PUT',
        data: {isActive: false},
      });
    },
    onSuccess: response => {
      setApiQueryData(queryClient, [userEndpoint], response);
      formModel.setInitialData(response);
      addSuccessMessage(t("%s's account has been deactivated.", response.email));
    },
  });

  const removeUser = (actionType: DeleteType) =>
    actionType === 'delete' ? deleteMutation.mutate() : deactivateMutation.mutate();

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (!user) {
    return null;
  }

  const openDeleteModal = () =>
    openModal(opts => <RemoveUserModal user={user} onRemove={removeUser} {...opts} />);

  return (
    <Fragment>
      <h3>{t('Users')}</h3>
      <p>{t('Editing user: %s', user.email)}</p>
      <Form
        model={formModel}
        initialData={user}
        apiMethod="PUT"
        apiEndpoint={userEndpoint}
        requireChanges
        onSubmitError={err => {
          addErrorMessage(err?.responseJSON?.detail);
        }}
        onSubmitSuccess={response => {
          setApiQueryData(queryClient, [userEndpoint], response);
          addSuccessMessage(t('User account updated.'));
        }}
        extraButton={
          <Button
            onClick={openDeleteModal}
            style={{marginLeft: space(1)}}
            priority="danger"
          >
            {t('Remove User')}
          </Button>
        }
      >
        <JsonForm forms={[userEditForm]} />
      </Form>
    </Fragment>
  );
}

const ModalFooter = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  justify-content: end;
  padding: 20px 30px;
  margin: 20px -30px -30px;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;

export default AdminUserEdit;
