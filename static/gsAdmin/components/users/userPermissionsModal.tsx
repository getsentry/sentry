import {Fragment} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import Form from 'sentry/components/forms/form';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

type Props = ModalRenderProps & {
  onSubmit: (user: User) => void;
  user: User;
};

type UserPermissionsConfigProps = DeprecatedAsyncComponent['props'] & {
  onSubmit: (user: User) => void;
  user: User;
};

type UserPermissionsConfigState = DeprecatedAsyncComponent['state'] & {
  availablePermissions: string[] | null;
  permissionList: string[] | null;
};

class UserPermissionsConfig extends DeprecatedAsyncComponent<
  UserPermissionsConfigProps,
  UserPermissionsConfigState
> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [
      ['availablePermissions', `/users/${this.props.user.id}/permissions/config/`],
      ['permissionList', `/users/${this.props.user.id}/permissions/`],
    ];
  }

  renderBody() {
    const {user} = this.props;
    const {availablePermissions, permissionList} = this.state;

    return (
      <Form
        onSubmit={(data, onSuccess, onError) => {
          addLoadingMessage(t('Saving changes\u2026'));

          // XXX(dcramer): why did i optimize the api for individual idempotent perm changes..

          // existing users permissions
          const currentPerms = new Set(permissionList);

          // permissions as defined by form submission
          const newPerms: string[] = availablePermissions!.filter(k => data[k]);
          const addedPerms = newPerms.filter(perm => !currentPerms.has(perm));
          const removedPerms = permissionList!.filter(perm => !data[perm]);

          const requests = [
            this.api.requestPromise(`/users/${user.id}/`, {
              method: 'PUT',
              data: {isSuperuser: data.isSuperuser, isStaff: data.isStaff},
            }),
            ...addedPerms.map(perm =>
              this.api.requestPromise(`/users/${user.id}/permissions/${perm}/`, {
                method: 'POST',
              })
            ),
            ...removedPerms.map(perm =>
              this.api.requestPromise(`/users/${user.id}/permissions/${perm}/`, {
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
        onSubmitSuccess={this.props.onSubmit}
        initialData={{
          isSuperuser: user.isSuperuser,
          isStaff: user.isStaff,
          ...Object.fromEntries(
            availablePermissions!.map(k => [k, permissionList!.includes(k)])
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
        {availablePermissions!.map(perm => (
          <BooleanField {...fieldProps} key={perm} name={perm} label={perm} />
        ))}
      </Form>
    );
  }
}

function UserPermissionsModal({Body, Header, user, onSubmit, closeModal}: Props) {
  return (
    <Fragment>
      <Header closeButton>Edit Permissions</Header>
      <Body>
        <UserPermissionsConfig
          user={user}
          onSubmit={newUser => {
            onSubmit(newUser);
            closeModal();
          }}
        />
      </Body>
    </Fragment>
  );
}

export default UserPermissionsModal;
