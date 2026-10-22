import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
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

const userPermissionsSchema = z.object({
  isStaff: z.boolean(),
  isSuperuser: z.boolean(),
  permissionChoices: z.array(
    z.object({
      permission: z.string(),
      enabled: z.boolean(),
    })
  ),
});

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
  const uneditablePermissions = permissions.filter(
    permission => !available.includes(permission)
  );

  const mutation = useMutation({
    mutationFn: async (data: {
      isStaff: boolean;
      isSuperuser: boolean;
      permissions: string[];
    }) => {
      const currentPerms = new Set(permissions);
      const selectedPerms = new Set(data.permissions);
      const newPerms = available.filter(perm => selectedPerms.has(perm));
      const addedPerms = newPerms.filter(perm => !currentPerms.has(perm));
      const removedPerms = permissions.filter(perm => !selectedPerms.has(perm));

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
        permissions: new Set([...newPerms, ...uneditablePermissions]),
      };
    },
    onSuccess: newUser => {
      onSubmit(newUser);
      closeModal();
    },
    onError: () => addErrorMessage('Unable to update user permissions.'),
  });

  const defaultValues = {
    isSuperuser: user.isSuperuser,
    isStaff: user.isStaff,
    permissionChoices: available.map(permission => ({
      permission,
      enabled: permissions.includes(permission),
    })),
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: userPermissionsSchema},
    onSubmit: ({value}) =>
      mutation
        .mutateAsync({
          isStaff: value.isStaff,
          isSuperuser: value.isSuperuser,
          permissions: [
            ...value.permissionChoices
              .filter(choice => choice.enabled)
              .map(choice => choice.permission),
            ...uneditablePermissions,
          ],
        })
        .catch(() => {}),
  });

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
              <Grid columns="minmax(0, 1fr) max-content" align="center" gap="md">
                <field.Meta.Label>
                  Grant superuser permission (required for admin access).
                </field.Meta.Label>
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </Grid>
            )}
          </form.AppField>
          <form.AppField name="isStaff">
            {field => (
              <Grid columns="minmax(0, 1fr) max-content" align="center" gap="md">
                <field.Meta.Label>
                  Grant staff permission (WIP, will be required for admin access in the
                  future).
                </field.Meta.Label>
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </Grid>
            )}
          </form.AppField>
          <Heading as="h5" size="md">
            Additional Permissions
          </Heading>
          <form.AppField name="permissionChoices" mode="array">
            {arrayField =>
              arrayField.state.value.map(({permission}, index) => (
                <form.AppField
                  key={permission}
                  name={`permissionChoices[${index}].enabled`}
                >
                  {field => (
                    <Grid
                      columns="12rem max-content"
                      align="center"
                      gap="md"
                      width="fit-content"
                    >
                      <field.Meta.Label>{permission}</field.Meta.Label>
                      <field.Switch
                        checked={field.state.value}
                        onChange={field.handleChange}
                      />
                    </Grid>
                  )}
                </form.AppField>
              ))
            }
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>Save Changes</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
