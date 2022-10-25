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
    jest.clearAllMocks();

    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/eventsv2/`,
      body: {data: []},
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('Accepts user input', async () => {
    render(<SearchBar {...testProps} />);

    userEvent.type(screen.getByRole('textbox'), 'clie');
    expect(screen.getByRole('textbox')).toHaveValue('clie');

    act(() => {
      jest.runAllTimers();
    });

    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));
  });

  it('Sends user input as transaction search', async () => {
    render(<SearchBar {...testProps} />);

    userEvent.type(screen.getByRole('textbox'), 'proje');
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
  });
});
