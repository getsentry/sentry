import {Fragment, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {RadioGroup} from 'sentry/components/forms/controls/radioGroup';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

function userDetailsQueryOptions(userId: string) {
  return apiOptions.as<User>()('/users/$userId/', {
    path: {userId},
    staleTime: 0,
  });
}

const schema = z.object({
  name: z.string().trim().min(1, t('Name is required')),
  username: z.string().trim().min(1, t('Username is required')),
  email: z.string().email(t('A valid email is required')),
  isActive: z.boolean(),
  isStaff: z.boolean(),
  isSuperuser: z.boolean(),
});

// The `/users/$userId/` PUT endpoint accepts these editable fields.
type UserUpdatePayload = z.infer<typeof schema>;

function toFormValues(user: User): UserUpdatePayload {
  return {
    name: user.name,
    username: user.username,
    email: user.email,
    isActive: user.isActive,
    isStaff: user.isStaff,
    isSuperuser: user.isSuperuser,
  };
}

type DeleteType = 'disable' | 'delete';

type RemoveModalProps = ModalRenderProps & {
  onRemove: (type: DeleteType) => void;
  user: User;
};

function RemoveUserModal({user, onRemove, closeModal, Footer}: RemoveModalProps) {
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
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button variant="danger" onClick={handleRemove}>
            {deleteType === 'delete' ? t('Permanently Delete User') : t('Disable User')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

function AdminUserEditForm({
  user,
  userEndpoint,
}: {
  user: User;
  userEndpoint: ReturnType<typeof getApiUrl>;
}) {
  const {openModal} = useModal();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data: UserUpdatePayload) =>
      fetchMutation<User>({url: userEndpoint, method: 'PUT', data}),
    onSuccess: response => {
      queryClient.setQueryData(userDetailsQueryOptions(user.id).queryKey, prev => ({
        json: response,
        headers: prev?.headers ?? {},
      }));
      form.reset(toFormValues(response));
      addSuccessMessage(t('User account updated.'));
    },
    onError: error => {
      const detail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      addErrorMessage(
        typeof detail === 'string' ? detail : t('Failed to update user account.')
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: userEndpoint,
        method: 'DELETE',
        data: {hardDelete: true, organizations: []},
      }),
    onSuccess: () => {
      addSuccessMessage(t("%s's account has been deleted.", user.email));
      navigate('/manage/users/', {replace: true});
    },
    onError: () => {
      addErrorMessage(t('Failed to delete user account.'));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () =>
      fetchMutation<User>({
        url: userEndpoint,
        method: 'PUT',
        data: {isActive: false},
      }),
    onSuccess: response => {
      queryClient.setQueryData(userDetailsQueryOptions(user.id).queryKey, prev => ({
        json: response,
        headers: prev?.headers ?? {},
      }));
      form.reset(toFormValues(response));
      addSuccessMessage(t("%s's account has been deactivated.", response.email));
    },
    onError: () => {
      addErrorMessage(t('Failed to deactivate user account.'));
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: toFormValues(user),
    validators: {onDynamic: schema},
    onSubmit: ({value}) => updateMutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <Fragment>
      <form.AppForm form={form}>
        <form.FieldGroup title={t('User details')}>
          <form.AppField name="name">
            {field => (
              <field.Layout.Row label={t('Name')} required>
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="username">
            {field => (
              <field.Layout.Row
                label={t('Username')}
                hintText={t('The username is the unique id of the user in the system')}
                required
              >
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="email">
            {field => (
              <field.Layout.Row
                label={t('Email')}
                hintText={t('The users primary email address')}
                required
              >
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="isActive">
            {field => (
              <field.Layout.Row
                label={t('Active')}
                hintText={t(
                  'Designates whether this user should be treated as active. Unselect this instead of deleting accounts.'
                )}
              >
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="isStaff">
            {field => (
              <field.Layout.Row
                label={t('Admin')}
                hintText={t(
                  'Designates whether this user can perform administrative functions.'
                )}
              >
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.AppField name="isSuperuser">
            {field => (
              <field.Layout.Row
                label={t('Superuser')}
                hintText={t(
                  'Designates whether this user has all permissions without explicitly assigning them.'
                )}
              >
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>
        </form.FieldGroup>

        <Flex justify="end" gap="md" padding="md">
          <Button
            onClick={() =>
              openModal(opts => (
                <RemoveUserModal
                  user={user}
                  onRemove={actionType =>
                    actionType === 'delete'
                      ? deleteMutation.mutate()
                      : deactivateMutation.mutate()
                  }
                  {...opts}
                />
              ))
            }
            variant="danger"
          >
            {t('Remove User')}
          </Button>
          <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
        </Flex>
      </form.AppForm>
    </Fragment>
  );
}

function AdminUserEdit() {
  const {id} = useParams<{id: string}>();
  const userEndpoint = getApiUrl('/users/$userId/', {path: {userId: id}});
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isPlaceholderData,
    isError,
    error,
    refetch,
  } = useQuery({
    ...userDetailsQueryOptions(id),
    placeholderData: () => {
      const found = queryClient
        .getQueriesData<ApiResponse<User[]>>({queryKey: [getApiUrl('/users/')]})
        .flatMap(([, data]) => data?.json ?? [])
        .find(candidate => candidate.id === id);
      return found ? {json: found, headers: {}} : undefined;
    },
  });

  const notFound = error instanceof RequestError && error.status === 404;

  return (
    <Fragment>
      <BreadcrumbTitle title={user ? user.name || user.email : t('Details')} />
      {isLoading || isPlaceholderData ? (
        <LoadingIndicator />
      ) : isError && !notFound ? (
        <LoadingError onRetry={refetch} />
      ) : notFound || !user ? (
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t('The user you were looking for was not found.')}
          </Alert>
        </Alert.Container>
      ) : (
        <AdminUserEditForm user={user} userEndpoint={userEndpoint} />
      )}
    </Fragment>
  );
}

export default AdminUserEdit;
