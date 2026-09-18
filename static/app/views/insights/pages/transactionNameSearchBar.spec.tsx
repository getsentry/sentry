import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {TransactionNameSearchBar} from 'sentry/views/insights/pages/transactionNameSearchBar';

jest.unmock('@tanstack/react-pacer');

describe('TransactionNameSearchBar', () => {
  const organization = OrganizationFixture();
  const url = `/organizations/${organization.slug}/trace-items/attributes/transaction/values/`;

  function mockSuggestions({
    query,
    value = 'example-transaction',
    asyncDelay,
  }: {asyncDelay?: Promise<void>; query?: string; value?: string} = {}) {
    return MockApiClient.addMockResponse({
      url,
      body: [{value, name: value, key: 'transaction', count: 1}],
      match: query ? [MockApiClient.matchQuery({substringMatch: query})] : [],
      asyncDelay,
    });
  }

  function renderSearchBar() {
    const onSearch = jest.fn();
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
    const {router} = render(
      <TransactionNameSearchBar
        organization={organization}
        projectIds={[]}
        query=""
        onSearch={onSearch}
      />
    );
    return {user, input: screen.getByRole('textbox'), onSearch, router};
  }

  async function advanceTime(ms = DEFAULT_DEBOUNCE_DURATION) {
    await act(() => jest.advanceTimersByTimeAsync(ms));
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fetches immediately, then debounces subsequent keystrokes to the latest input', async () => {
    const request = mockSuggestions();
    const {user, input} = renderSearchBar();

    await user.type(input, 'sea');
    expect(request).toHaveBeenCalledTimes(1);

    await user.type(input, 'rch');
    await advanceTime(DEFAULT_DEBOUNCE_DURATION - 1);
    expect(request).toHaveBeenCalledTimes(1);

    await advanceTime(1);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith(
      url,
      expect.objectContaining({
        query: expect.objectContaining({substringMatch: 'search'}),
      })
    );
    expect(await screen.findByText('example-transaction')).toBeInTheDocument();
  });

  it('keeps the latest suggestions when an older request finishes later', async () => {
    const older = Promise.withResolvers<void>();
    mockSuggestions({query: 'sea', value: 'old-result', asyncDelay: older.promise});
    mockSuggestions({query: 'search', value: 'new-result'});
    const {user, input} = renderSearchBar();

    await user.type(input, 'sea');
    await user.type(input, 'rch');
    await advanceTime();
    expect(await screen.findByText('new-result')).toBeInTheDocument();

    await act(() => {
      older.resolve();
      return older.promise;
    });
    expect(screen.getByText('new-result')).toBeInTheDocument();
    expect(screen.queryByText('old-result')).not.toBeInTheDocument();
  });

  it.each(['checkout', 'queue:process'])(
    'preserves the transaction name %s when opening its summary',
    async transaction => {
      mockSuggestions({value: transaction});
      const {user, input, router} = renderSearchBar();

      await user.type(input, transaction.slice(0, 3));
      const suggestion = await screen.findByRole('option');
      await user.click(within(suggestion).getByRole('img'));

      expect(router.location.query.transaction).toBe(transaction);
    }
  );

  it('submits a suggestion selected with the keyboard', async () => {
    mockSuggestions();
    const {user, input, onSearch} = renderSearchBar();

    await user.type(input, 'sea');
    await screen.findByText('example-transaction');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSearch).toHaveBeenCalledWith('transaction:"example-transaction"');
    expect(screen.queryByTestId('smart-search-dropdown')).not.toBeInTheDocument();
  });
});
