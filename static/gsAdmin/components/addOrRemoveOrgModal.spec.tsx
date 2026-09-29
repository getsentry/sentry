import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import {AddToOrgModal} from 'admin/components/addOrRemoveOrgModal';

function ModalSection({children}: {children?: React.ReactNode}) {
  return <div>{children}</div>;
}

describe('AddToOrgModal', () => {
  it('submits the selected organization role', async () => {
    const closeModal = jest.fn();
    const request = MockApiClient.addMockResponse({
      url: '/customers/org-slug/users/123/members/',
      method: 'POST',
      body: {},
    });

    render(
      <AddToOrgModal
        Header={ModalSection}
        Body={ModalSection as ModalRenderProps['Body']}
        Footer={ModalSection as ModalRenderProps['Footer']}
        CloseButton={ModalSection}
        closeModal={closeModal}
        userId="123"
      />
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Organization Slug'}),
      'org-slug'
    );
    await userEvent.click(screen.getByRole('textbox', {name: 'Role'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Member'}));
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/customers/org-slug/users/123/members/',
        expect.objectContaining({
          method: 'POST',
          data: {orgRole: 'member'},
        })
      );
      expect(closeModal).toHaveBeenCalled();
      expect(testableWindowLocation.reload).toHaveBeenCalled();
    });
  });
});
