import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
});
