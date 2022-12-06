import {browserHistory} from 'react-router';
import type {Location} from 'history';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {
  EntryType,
  Event,
  EventError,
  EventOrGroupType,
  ExceptionType,
  ExceptionValue,
  Frame,
} from 'sentry/types/event';
import EventView, {EventData} from 'sentry/utils/discover/eventView';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';

import EventContext from './eventContext';

const makeEvent = (event: Partial<Event> = {}): Event => {
  const evt: Event = {
    ...TestStubs.Event(),
    ...event,
  };

  return evt;
};

const dataRow: EventData = {
  id: '6b43e285de834ec5b5fe30d62d549b20',
  issue: 'SENTRY-VVY',
  release: 'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76',
  'issue.id': 3512441874,
  'project.name': 'sentry',
};

const mockEventView = EventView.fromSavedQuery({
  id: '',
  name: 'test query',
  version: 2,
  fields: ['title', 'issue'],
  projects: [1],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderQuickContextContent = (location?: Location, eventView?: EventView) => {
  const organization = TestStubs.Organization();
  render(
    <QueryClientProvider client={queryClient}>
      <EventContext
        dataRow={dataRow}
        organization={organization}
        location={location}
        eventView={eventView}
      />
    </QueryClientProvider>,
    {organization}
  );
};

describe('Quick Context Content: Event ID Column', function () {
  afterEach(() => {
    queryClient.clear();
    MockApiClient.clearMockResponses();
  });

  it('Renders transaction duration context', async () => {
    const currentTime = Date.now();
    const mockedLocation = TestStubs.location({
      query: {
        field: 'title',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
      body: makeEvent({
        type: EventOrGroupType.TRANSACTION,
        entries: [],
        endTimestamp: currentTime,
        startTimestamp: currentTime - 2,
      }),
    });
    renderQuickContextContent(mockedLocation);

    expect(await screen.findByText(/Transaction Duration/i)).toBeInTheDocument();
    expect(screen.getByText(/2.00s/i)).toBeInTheDocument();

    const addAsColumnButton = screen.getByTestId(
      'quick-context-transaction-duration-add-button'
    );
    expect(addAsColumnButton).toBeInTheDocument();

    userEvent.click(addAsColumnButton);
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mock-pathname/',
        query: expect.objectContaining({
          field: ['title', 'transaction.duration'],
        }),
      })
    );
  });

  it('Renders transaction status context', async () => {
    const currentTime = Date.now();
    const mockedLocation = TestStubs.location({
      query: {
        field: 'title',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
      body: makeEvent({
        type: EventOrGroupType.TRANSACTION,
        entries: [],
        endTimestamp: currentTime,
        startTimestamp: currentTime - 2,
        contexts: {
          trace: {
            status: 'ok',
          },
        },
        tags: [
          {
            key: 'http.status_code',
            value: '200',
          },
        ],
      }),
    });
    renderQuickContextContent(mockedLocation);

    expect(await screen.findByText(/Status/i)).toBeInTheDocument();
    expect(screen.getByText(/ok/i)).toBeInTheDocument();
    expect(screen.getByText(/HTTP 200/i)).toBeInTheDocument();

    const addAsColumnButton = screen.getByTestId('quick-context-http-status-add-button');
    expect(addAsColumnButton).toBeInTheDocument();

    userEvent.click(addAsColumnButton);
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mock-pathname/',
        query: expect.objectContaining({
          field: ['title', 'http.status_code'],
        }),
      })
    );
  });

  it('Adds columns for saved query', async () => {
    const currentTime = Date.now();
    const mockedLocation = TestStubs.location({
      query: {
        field: null,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
      body: makeEvent({
        type: EventOrGroupType.TRANSACTION,
        entries: [],
        endTimestamp: currentTime,
        startTimestamp: currentTime - 2,
      }),
    });
    renderQuickContextContent(mockedLocation, mockEventView);

    const addAsColumnButton = await screen.findByTestId(
      'quick-context-transaction-duration-add-button'
    );
    expect(addAsColumnButton).toBeInTheDocument();

    userEvent.click(addAsColumnButton);
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mock-pathname/',
        query: expect.objectContaining({
          field: ['title', 'issue', 'transaction.duration'],
        }),
      })
    );
  });

  it('Renders NO stack trace message for error events without stackTraces', async () => {
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => null);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
      body: makeEvent({type: EventOrGroupType.ERROR, entries: []}),
    });

    renderQuickContextContent();

    expect(
      await screen.findByText(/There is no stack trace available for this event./i)
    ).toBeInTheDocument();
  });

  it('Renders stack trace as context', async () => {
    const frame: Frame = {
      colNo: 0,
      filename: 'file.js',
      function: 'throwError',
      lineNo: 0,
      absPath: null,
      context: [],
      errors: null,
      inApp: false,
      instructionAddr: null,
      module: null,
      package: null,
      platform: null,
      rawFunction: null,
      symbol: null,
      symbolAddr: null,
      trust: undefined,
      vars: null,
    };

    const thread: ExceptionValue = {
      stacktrace: {
        hasSystemFrames: false,
        registers: {},
        framesOmitted: 0,
        frames: [frame],
      },
      mechanism: null,
      module: null,
      rawStacktrace: null,
      threadId: null,
      type: '',
      value: '',
    };

    const exceptionValue: ExceptionType = {
      values: [thread],
      excOmitted: undefined,
      hasSystemFrames: false,
    };

    const errorEvent: Event = {
      id: '6b43e285de834ec5b5fe30d62d549b20',
      type: EventOrGroupType.ERROR,
      entries: [
        {
          type: EntryType.EXCEPTION,
          data: exceptionValue,
        },
      ],
    } as EventError;

    const mockedLocation = TestStubs.location({
      query: {
        field: ['issue', 'transaction.duration'],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
      body: makeEvent(errorEvent),
    });

    renderQuickContextContent(mockedLocation);

    expect(await screen.findByTestId('stack-trace-content')).toBeInTheDocument();

    const addAsColumnButton = screen.getByTestId('quick-context-title-add-button');
    expect(addAsColumnButton).toBeInTheDocument();
    expect(screen.getByText(/Title/i)).toBeInTheDocument();

    userEvent.click(addAsColumnButton);
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/mock-pathname/',
        query: expect.objectContaining({
          field: ['issue', 'transaction.duration', 'title'],
        }),
      })
    );
  });
});
