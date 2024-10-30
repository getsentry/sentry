import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {DEFAULT_EVENT_VIEW} from 'sentry/views/discover/data';
import {useTransactionData} from 'sentry/views/replays/detail/trace/replayTransactionContext';
import Trace from 'sentry/views/replays/detail/trace/trace';

jest.mock('sentry/views/replays/detail/trace/replayTransactionContext');

const mockUseTransactionData = jest.mocked(useTransactionData);

function setMockTransactionState({
  didInit = false,
  errors = [],
  isFetching = false,
  traces = undefined,
}: Partial<ReturnType<typeof useTransactionData>['state']>) {
  const eventView = EventView.fromSavedQuery(DEFAULT_EVENT_VIEW);
  mockUseTransactionData.mockReturnValue({
    state: {didInit, errors, isFetching, traces},
    eventView,
  });
}

describe('trace', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/`,
      body: {},
    });
    mockUseTransactionData.mockReset();
  });

  it('should show the blank screen if there is no replayRecord', () => {
    setMockTransactionState({});

    render(<Trace replay={undefined} />);

    const placeholder = screen.getByTestId('loading-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toBeEmptyDOMElement();
  });

  it('should show the blank screen if the hook has not initialized yet', () => {
    setMockTransactionState({});

    render(<Trace replay={ReplayRecordFixture()} />);

    const placeholder = screen.getByTestId('loading-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toBeEmptyDOMElement();
  });

  it('should show a loading spinner if the hook is fetching, but there are no traces returned yet', () => {
    setMockTransactionState({didInit: true, isFetching: true});

    render(<Trace replay={ReplayRecordFixture()} />);

    const placeholder = screen.getByTestId('loading-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).not.toBeEmptyDOMElement();
  });

  it('should show errors if there are any', () => {
    setMockTransactionState({
      didInit: true,
      isFetching: true,
      traces: [],
      errors: [new Error('Something went wrong')],
    });

    render(<Trace replay={ReplayRecordFixture()} />);

    const emptyState = screen.getByTestId('empty-state');
    expect(emptyState).toHaveTextContent('Unable to retrieve traces');
  });

  it('should show a `no traces found` message if fetching is done, and there are no traces returned', () => {
    setMockTransactionState({
      didInit: true,
      isFetching: false,
      traces: [],
      errors: [],
    });

    render(<Trace replay={ReplayRecordFixture()} />);

    const emptyState = screen.getByTestId('empty-state');
    expect(emptyState).toHaveTextContent('No traces found');
  });
});
