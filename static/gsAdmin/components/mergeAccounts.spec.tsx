import {UserFixture} from 'sentry-fixture/user';

import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {ModalStore} from 'sentry/stores/modalStore';

import {MergeAccountsModal} from './mergeAccounts';

describe('MergeAccountsModal', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
  });

  it('submits the selected accounts through the merge form', async () => {
    const account = UserFixture({id: '2', username: 'user@example.com'});
    MockApiClient.addMockResponse({
      url: '/users/1/merge-accounts/',
      body: {users: [account]},
    });
    const mergeRequest = MockApiClient.addMockResponse({
      url: '/users/1/merge-accounts/',
      method: 'POST',
      body: {},
    });

    openModal(deps => <MergeAccountsModal {...deps} userId="1" onAction={jest.fn()} />);
    renderGlobalModal();

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'user@example.com'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Merge Account(s)'}));

    await waitFor(() => {
      expect(mergeRequest).toHaveBeenCalledWith(
        '/users/1/merge-accounts/',
        expect.objectContaining({method: 'POST', data: {users: ['2']}})
      );
    });
  });
});
