import {useEffect} from 'react';
import {useMutation} from '@tanstack/react-query';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {User} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';

type Props = ModalRenderProps & {
  onSubmit: (user: User) => void;
  user: User;
};

export function UserPermissionsModal({
  Body,
  Header,
  Footer,
  user,
  onSubmit,
  closeModal,
}: Props) {
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
      const currentPerms = new Set(permissions);
      const newPerms = available.filter(k => data[k]);
      const addedPerms = newPerms.filter(perm => !currentPerms.has(perm));
      const removedPerms = permissions.filter(perm => !data[perm]);

      await Promise.all([
        fetchMutation({
          url: getApiUrl('/users/$userId/', {path: {userId: user.id}}),
          method: 'PUT',
          data: {isSuperuser: data.isSuperuser, isStaff: data.isStaff},
        }),
        ...addedPerms.map(perm =>
          fetchMutation({
            url: getApiUrl('/users/$userId/permissions/$permissionName/', {
              path: {userId: user.id, permissionName: perm},
            }),
            method: 'POST',
          })
        ),
        ...removedPerms.map(perm =>
          fetchMutation({
            url: getApiUrl('/users/$userId/permissions/$permissionName/', {
              path: {userId: user.id, permissionName: perm},
            }),
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
    onMutate: () => addLoadingMessage('Saving changes\u2026'),
    onSuccess: newUser => {
      onSubmit(newUser);
      closeModal();
    },
    onError: () => addErrorMessage('Unable to update user permissions.'),
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
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">Edit Permissions</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <form.AppField name="isSuperuser">
            {field => (
              <Grid columns="minmax(0, 1fr) auto" align="center" gap="md">
                <field.Meta.Label>
                  Grant superuser permission (required for admin access).
                </field.Meta.Label>
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </Grid>
            )}
          </form.AppField>
          <form.AppField name="isStaff">
            {field => (
              <Grid columns="minmax(0, 1fr) auto" align="center" gap="md">
                <field.Meta.Label>
                  Grant staff permission (WIP, will be required for admin access in the
                  future).
                </field.Meta.Label>
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </Grid>
            )}
          </form.AppField>
          <Heading as="h4">Additional Permissions</Heading>
          {available.map(perm => (
            <form.AppField key={perm} name={perm}>
              {field => (
                <Grid
                  columns="12rem max-content"
                  align="center"
                  gap="md"
                  width="fit-content"
                >
                  <field.Meta.Label>{perm}</field.Meta.Label>
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </Grid>
              )}
            </form.AppField>
          ))}
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>Save Changes</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
