import {Fragment} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import Form from 'sentry/components/forms/form';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {User} from 'sentry/types/user';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

type Props = ModalRenderProps & {
  onSubmit: (user: User) => void;
  user: User;
};

function UserPermissionsModal({Body, Header, user, onSubmit, closeModal}: Props) {
  const api = useApi({persistInFlight: true});

  const {
    data: availablePermissions,
    isPending: availablePermissionsLoading,
    isError: availablePermissionsError,
  } = useApiQuery<string[]>([`/users/${user.id}/permissions/config/`], {staleTime: 0});
  const {
    data: permissionList,
    isPending: permissionListLoading,
    isError: permissionListError,
  } = useApiQuery<string[]>([`/users/${user.id}/permissions/`], {staleTime: 0});

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
        <Form
          onSubmit={(data, onSuccess, onError) => {
            addLoadingMessage('Saving changes\u2026');

            // XXX(dcramer): why did i optimize the api for individual idempotent perm changes..

            // existing users permissions
            const currentPerms = new Set(permissionList);

            // permissions as defined by form submission
            const newPerms: string[] = availablePermissions.filter(k => data[k]);
            const addedPerms = newPerms.filter(perm => !currentPerms.has(perm));
            const removedPerms = permissionList.filter(perm => !data[perm]);

            const requests = [
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
            ];

            Promise.all(requests)
              .then(() => {
                onSuccess({
                  // TODO(dcramer): we could technically pull latest user state from the isSuperuser submission and
                  // merge it here
                  ...user,
                  isSuperuser: data.isSuperuser,
                  isStaff: data.isStaff,
                  permissions: newPerms,
                });
              })
              .catch(error => {
                // TODO(dcramer): technically this is wrong and should probably reload the initial form data as
                // some of the API changes might have been successful whereas others were not. Probably ok though
                // just click some buttons again.
                onError(error);
              })
              .finally(() => {
                clearIndicators();
              });
          }}
          onSubmitSuccess={newUser => {
            onSubmit(newUser);
            closeModal();
          }}
          initialData={{
            isSuperuser: user.isSuperuser,
            isStaff: user.isStaff,
            ...Object.fromEntries(
              availablePermissions.map(k => [k, permissionList.includes(k)])
            ),
          }}
        >
          <BooleanField
            {...fieldProps}
            name="isSuperuser"
            label="Grant superuser permission (required for admin access)."
          />
          <BooleanField
            {...fieldProps}
            name="isStaff"
            label="Grant staff permission (WIP, will be required for admin access in the future)."
          />
          <h4>Additional Permissions</h4>
          {availablePermissions.map(perm => (
            <BooleanField {...fieldProps} key={perm} name={perm} label={perm} />
          ))}
        </Form>
      </Body>
    </Fragment>
  );
}

export default UserPermissionsModal;
