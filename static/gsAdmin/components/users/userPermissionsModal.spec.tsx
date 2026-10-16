import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';

import {UserPermissionsModal} from 'admin/components/users/userPermissionsModal';

function ModalSection({children}: {children?: React.ReactNode}) {
  return <div>{children}</div>;
}

describe('UserPermissionsModal', () => {
  it('selects permissions when query data loads', async () => {
    const user = UserFixture({isStaff: true, isSuperuser: false});
    MockApiClient.addMockResponse({
      url: `/users/${user.id}/permissions/config/`,
      body: ['users.admin', 'users.read'],
    });
    MockApiClient.addMockResponse({
      url: `/users/${user.id}/permissions/`,
      body: ['users.read'],
    });

    render(
      <UserPermissionsModal
        user={user}
        onSubmit={jest.fn()}
        closeModal={jest.fn()}
        Header={ModalSection}
        Body={ModalSection as ModalRenderProps['Body']}
        Footer={ModalSection as ModalRenderProps['Footer']}
        CloseButton={ModalSection}
      />
    );

    expect(await screen.findByLabelText('users.read')).toBeChecked();
    expect(screen.getByLabelText('users.admin')).not.toBeChecked();
  });

  it('saves each permission independently and preserves permissions outside the editable list', async () => {
    const user = UserFixture({isStaff: true, isSuperuser: false});
    const onSubmit = jest.fn();
    const closeModal = jest.fn();
    MockApiClient.addMockResponse({
      url: `/users/${user.id}/permissions/config/`,
      body: ['users.admin', 'users.read', 'users.keep'],
    });
    MockApiClient.addMockResponse({
      url: `/users/${user.id}/permissions/`,
      body: ['users.read', 'users.keep', 'users.unavailable'],
    });
    const updateUser = MockApiClient.addMockResponse({
      url: `/users/${user.id}/`,
      method: 'PUT',
      body: {},
    });
    const addPermission = MockApiClient.addMockResponse({
      url: `/users/${user.id}/permissions/users.admin/`,
      method: 'POST',
      body: {},
    });
    const removePermission = MockApiClient.addMockResponse({
      url: `/users/${user.id}/permissions/users.read/`,
      method: 'DELETE',
      body: {},
    });
    const removeUnavailablePermission = MockApiClient.addMockResponse({
      url: `/users/${user.id}/permissions/users.unavailable/`,
      method: 'DELETE',
      body: {},
    });

    render(
      <UserPermissionsModal
        user={user}
        onSubmit={onSubmit}
        closeModal={closeModal}
        Header={ModalSection}
        Body={ModalSection as ModalRenderProps['Body']}
        Footer={ModalSection as ModalRenderProps['Footer']}
        CloseButton={ModalSection}
      />
    );

    expect(await screen.findByRole('checkbox', {name: 'users.read'})).toBeChecked();
    await userEvent.click(screen.getByText('users.admin'));
    expect(screen.getByRole('checkbox', {name: 'users.admin'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'users.read'})).toBeChecked();
    await userEvent.click(screen.getByText('users.read'));
    expect(screen.getByRole('checkbox', {name: 'users.read'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'users.admin'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'users.keep'})).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: new Set(['users.admin', 'users.keep', 'users.unavailable']),
      })
    );
    expect(updateUser).toHaveBeenCalledWith(
      `/users/${user.id}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {isSuperuser: false, isStaff: true},
      })
    );
    expect(addPermission).toHaveBeenCalledTimes(1);
    expect(removePermission).toHaveBeenCalledTimes(1);
    expect(removeUnavailablePermission).not.toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalledTimes(1);
  });
});
