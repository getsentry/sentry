import {
  act,
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import SearchBar, {SearchBarProps} from 'sentry/components/performance/searchBar';
import EventView from 'sentry/utils/discover/eventView';

// Jest's fake timers don't advance the debounce timer, so we need to mock it
// with a different implementation. This could probably go in __mocks__ since
// it's used in a few tests.
jest.mock('lodash/debounce', () => {
  const debounceMap = new Map();
  const mockDebounce =
    (fn, timeout) =>
    (...args) => {
      if (debounceMap.has(fn)) {
        clearTimeout(debounceMap.get(fn));
      }
      debounceMap.set(
        fn,
        setTimeout(() => {
          fn.apply(fn, args);
          debounceMap.delete(fn);
        }, timeout)
      );
    };
  return mockDebounce;
});

describe('SearchBar', () => {
  let eventsMock;
  const organization = TestStubs.Organization();

  const testProps: SearchBarProps = {
    onSearch: jest.fn(),
    organization,
    eventView: EventView.fromSavedQuery({
      id: '',
      name: '',
      fields: [],
      projects: [],
      version: 2,
    }),
    query: '',
  };

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();

    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/eventsv2/`,
      body: {data: []},
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('Sends user input as a transaction search and shows the results', async () => {
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/eventsv2/`,
      body: {
        data: [{transaction: 'clients.call'}, {transaction: 'clients.fetch'}],
      },
    });

    render(<SearchBar {...testProps} />);

    userEvent.type(screen.getByRole('textbox'), 'proje');
    expect(screen.getByRole('textbox')).toHaveValue('proje');

    act(() => {
      jest.runAllTimers();
    });

    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/eventsv2/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'transaction:*proje* event.type:transaction',
        }),
      })
    );

    expect(screen.getByText(textWithMarkupMatcher('clients.call'))).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher('clients.fetch'))).toBeInTheDocument();
  });
});
