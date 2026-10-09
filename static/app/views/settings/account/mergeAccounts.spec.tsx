import {
  MergeAccountsFixture,
  MergeAccountsSingleAccountFixture,
} from 'sentry-fixture/mergeAccounts';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import MergeAccounts from 'sentry/views/settings/account/mergeAccounts';

const ENDPOINT = '/auth-v2/merge-accounts/';
const VERIFICATION_CODE_ENDPOINT = '/auth-v2/user-merge-verification-codes/';

describe('MergeAccounts', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: MergeAccountsFixture(),
    });
  });

  it('renders single account', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: MergeAccountsSingleAccountFixture(),
    });
    render(<MergeAccounts />);
    expect(
      await screen.findByText(
        "Only one account was found with your primary email address. You're all set."
      )
    ).toBeInTheDocument();
  });

  it('renders the current and other accounts in separate tables', async () => {
    render(<MergeAccounts />);

    const currentTable = await screen.findByRole('table', {
      name: 'Your currently active account:',
    });
    const otherTable = screen.getByRole('table', {name: 'Your other accounts:'});

    expect(
      within(currentTable)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Name', 'Last Active', 'Organizations']);
    expect(within(currentTable).getByRole('row', {name: /primary/})).toHaveTextContent(
      'Currently active'
    );
    expect(
      within(otherTable)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Name', 'Last Active', 'Organizations', 'Merge']);
    expect(within(otherTable).getByRole('row', {name: /merge me/})).toHaveTextContent(
      'hojicha, matcha'
    );
    expect(within(otherTable).getByRole('row', {name: /delete me/})).toHaveTextContent(
      'Never'
    );
    expect(
      within(otherTable).getByRole('checkbox', {name: 'Merge merge me'})
    ).not.toBeChecked();
    expect(within(currentTable).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('can post verification code', async () => {
    const mock = MockApiClient.addMockResponse({
      url: VERIFICATION_CODE_ENDPOINT,
      method: 'POST',
      statusCode: 200,
    });

    render(<MergeAccounts />);
    renderGlobalModal();
    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Generate verification code'})
    );

    expect(mock).toHaveBeenCalledWith(
      VERIFICATION_CODE_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        data: {},
      })
    );
  });

  it('can select accounts', async () => {
    render(<MergeAccounts />);
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('checkbox', {name: 'Merge merge me'}));
    expect(
      screen.getByText('Merge 1 account(s) into Foo Bar and delete 1 account(s)') // the signed in user is named Foo Bar
    ).toBeInTheDocument();
  });

  it('can submit merge request', async () => {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      statusCode: 200,
      body: MergeAccountsSingleAccountFixture(),
    });
    render(<MergeAccounts />);
    renderGlobalModal();
    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole('button', {name: 'Submit'}));

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        data: {
          idsToMerge: [],
          idsToDelete: ['2', '3'],
          verificationCode: '',
        },
      })
    );
  });
});
