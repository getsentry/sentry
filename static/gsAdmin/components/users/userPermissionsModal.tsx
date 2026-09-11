import {Fragment, useEffect} from 'react';
import {useMutation} from '@tanstack/react-query';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {User} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';

type Props = ModalRenderProps & {
  onSubmit: (user: User) => void;
  user: User;
};

export function UserPermissionsModal({Body, Header, user, onSubmit, closeModal}: Props) {
  const api = useApi({persistInFlight: true});

  const {
    data: availablePermissions,
    isPending: availablePermissionsLoading,
    isError: availablePermissionsError,
  } = useApiQuery<string[]>(
    [
      getApiUrl('/users/$userId/permissions/config/', {
        path: {userId: user.id},
      }),
    ],
    {staleTime: 0}
  );
  const {
    data: permissionList,
    isPending: permissionListLoading,
    isError: permissionListError,
  } = useApiQuery<string[]>(
    [
      getApiUrl('/users/$userId/permissions/', {
        path: {userId: user.id},
      }),
    ],
    {staleTime: 0}
  );

  const permissions = permissionList ?? [];
  const available = availablePermissions ?? [];

  const mutation = useMutation({
    mutationFn: async (data: Record<string, boolean>) => {
      addLoadingMessage('Saving changes\u2026');
      const currentPerms = new Set(permissions);
      const newPerms = available.filter(k => data[k]);
      const addedPerms = newPerms.filter(perm => !currentPerms.has(perm));
      const removedPerms = permissions.filter(perm => !data[perm]);

      await Promise.all([
        api.requestPromise(`/users/${user.id}/`, {
          method: 'PUT',
          data: {isSuperuser: data.isSuperuser, isStaff: data.isStaff},
        }),
        ...addedPerms.map(perm =>
          api.requestPromise(`/users/${user.id}/permissions/${perm}/`, {
            method: 'POST',
          })
        ),
        ...removedPerms.map(perm =>
          api.requestPromise(`/users/${user.id}/permissions/${perm}/`, {
            method: 'DELETE',
          })
        ),
      ]);

      return {
        ...user,
        isSuperuser: Boolean(data.isSuperuser),
        isStaff: Boolean(data.isStaff),
        permissions: new Set(newPerms),
      };
    },
    onSuccess: newUser => {
      onSubmit(newUser);
      closeModal();
    },
    onSettled: clearIndicators,
  });

  const defaultValues: Record<string, boolean> = {
    isSuperuser: user.isSuperuser,
    isStaff: user.isStaff,
    ...Object.fromEntries(available.map(k => [k, permissions.includes(k)])),
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  useEffect(() => {
    if (availablePermissions && permissionList) {
      form.reset({
        isSuperuser: user.isSuperuser,
        isStaff: user.isStaff,
        ...Object.fromEntries(
          availablePermissions.map(k => [k, permissionList.includes(k)])
        ),
      });
    }
  }, [availablePermissions, permissionList, form, user.isStaff, user.isSuperuser]);

  if (permissionListError || availablePermissionsError) {
    return <LoadingError />;
  }

  if (permissionListLoading || availablePermissionsLoading) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      <Header closeButton>Edit Permissions</Header>
      <Body>
        <form.AppForm form={form}>
          <Stack gap="lg">
            <form.AppField name="isSuperuser">
              {field => (
                <field.Layout.Stack label="Grant superuser permission (required for admin access).">
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="isStaff">
              {field => (
                <field.Layout.Stack label="Grant staff permission (WIP, will be required for admin access in the future).">
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <Heading as="h4">Additional Permissions</Heading>
            {available.map(perm => (
              <form.AppField key={perm} name={perm}>
                {field => (
                  <field.Layout.Stack label={perm}>
                    <field.Switch
                      checked={field.state.value}
                      onChange={field.handleChange}
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            ))}
            <form.SubmitButton>Save Changes</form.SubmitButton>
          </Stack>
        </form.AppForm>
      </Body>
    </Fragment>
  );
}
