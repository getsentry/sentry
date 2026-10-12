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
    MockApiClient.addMockResponse({url: '/users/', body: []});
  });

  it('requires an account before submitting', async () => {
    MockApiClient.addMockResponse({
      url: '/users/1/merge-accounts/',
      body: {users: []},
    });
    const mergeRequest = MockApiClient.addMockResponse({
      url: '/users/1/merge-accounts/',
      method: 'POST',
      body: {},
    });

    openModal(deps => <MergeAccountsModal {...deps} userId="1" onAction={jest.fn()} />);
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Merge Account(s)'}));

    expect(await screen.findByText('Select at least one account')).toBeInTheDocument();
    expect(mergeRequest).not.toHaveBeenCalled();
  });

  it('shows users before searching', async () => {
    const account = UserFixture({id: '2', username: 'other@example.com'});
    MockApiClient.addMockResponse({
      url: '/users/1/merge-accounts/',
      body: {users: []},
    });
    MockApiClient.addMockResponse({url: '/users/', body: [account]});

    openModal(deps => <MergeAccountsModal {...deps} userId="1" onAction={jest.fn()} />);
    renderGlobalModal();

    await userEvent.click(
      await screen.findByRole('textbox', {name: 'Accounts to merge'})
    );
    expect(
      await screen.findByRole('menuitemcheckbox', {name: 'other@example.com'})
    ).toBeInTheDocument();
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
      await screen.findByRole('textbox', {name: 'Accounts to merge'})
    );
    await userEvent.click(
      await screen.findByRole('menuitemcheckbox', {name: 'user@example.com'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Merge Account(s)'}));

    await waitFor(() => {
      expect(mergeRequest).toHaveBeenCalledWith(
        '/users/1/merge-accounts/',
        expect.objectContaining({method: 'POST', data: {users: ['2']}})
      );
    });
  });

  it('merges multiple users selected from suggestions and search', async () => {
    const suggestedAccount = UserFixture({id: '2', username: 'suggested@example.com'});
    const searchedAccount = UserFixture({id: '3', username: 'searched@example.com'});
    MockApiClient.addMockResponse({
      url: '/users/1/merge-accounts/',
      body: {users: [suggestedAccount]},
    });
    MockApiClient.addMockResponse({
      url: '/users/',
      body: [searchedAccount],
    });
    const mergeRequest = MockApiClient.addMockResponse({
      url: '/users/1/merge-accounts/',
      method: 'POST',
      body: {},
    });

    openModal(deps => <MergeAccountsModal {...deps} userId="1" onAction={jest.fn()} />);
    renderGlobalModal();

    const input = await screen.findByRole('textbox', {name: 'Accounts to merge'});
    await userEvent.click(input);
    await userEvent.click(
      await screen.findByRole('menuitemcheckbox', {name: 'suggested@example.com'})
    );
    await userEvent.type(input, 'searched');
    await userEvent.click(
      await screen.findByRole('menuitemcheckbox', {name: 'searched@example.com'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Merge Account(s)'}));

    await waitFor(() => {
      expect(mergeRequest).toHaveBeenCalledWith(
        '/users/1/merge-accounts/',
        expect.objectContaining({method: 'POST', data: {users: ['2', '3']}})
      );
    });
  });
});
