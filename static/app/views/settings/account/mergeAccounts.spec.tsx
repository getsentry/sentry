import {
  MergeAccountsFixture,
  MergeAccountsSingleAccountFixture,
} from 'sentry-fixture/mergeAccounts';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import MergeAccounts from 'sentry/views/settings/account/mergeAccounts';

const ENDPOINT = '/auth-v2/merge-accounts/';
const VERIFICATION_CODE_ENDPOINT = '/auth-v2/user-merge-verification-codes/';

describe('MergeAccounts', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: MergeAccountsFixture(),
    });
  });

  it('renders single account', async function () {
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

  it('can post verification code', async function () {
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

  it('can select accounts', async function () {
    render(<MergeAccounts />);
    renderGlobalModal();

    const checkbox = (await screen.findAllByRole('checkbox'))[0]!;
    await userEvent.click(checkbox);
    expect(
      screen.getByText('Merge 1 account(s) into Foo Bar and delete 1 account(s)') // the signed in user is named Foo Bar
    ).toBeInTheDocument();
  });

  it('can submit merge request', async function () {
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
