import type {Location} from 'history';
import {EventFixture} from 'sentry-fixture/event';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import type {
  Event,
  EventError,
  ExceptionType,
  ExceptionValue,
  Frame,
} from 'sentry/types/event';
import {EntryType, EventOrGroupType} from 'sentry/types/event';
import type {EventData} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {QueryClientProvider} from 'sentry/utils/queryClient';

import EventContext from './eventContext';

const mockedLocation = LocationFixture({
  query: {
    field: ['issue', 'transaction.duration'],
  },
});

const dataRow: EventData = {
  id: '6b43e285de834ec5b5fe30d62d549b20',
  issue: 'SENTRY-VVY',
  release: 'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76',
  'issue.id': 3512441874,
  'project.name': 'sentry',
};

const renderEventContext = (location?: Location, eventView?: EventView) => {
  const organization = OrganizationFixture();
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
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
    MockApiClient.clearMockResponses();
  });

  it('Renders transaction duration context', async () => {
    const currentTime = Date.now();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
      body: EventFixture({
        type: EventOrGroupType.TRANSACTION,
        entries: [],
        endTimestamp: currentTime,
        startTimestamp: currentTime - 2,
      }),
    });
    renderEventContext(mockedLocation);

    expect(await screen.findByText(/Transaction Duration/i)).toBeInTheDocument();
    expect(screen.getByText(/2.00s/i)).toBeInTheDocument();
  });

  it('Renders transaction status context', async () => {
    const currentTime = Date.now();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
      body: EventFixture({
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
    renderEventContext(mockedLocation);

    expect(await screen.findByText(/Status/i)).toBeInTheDocument();
    expect(screen.getByText(/ok/i)).toBeInTheDocument();
    expect(screen.getByText(/HTTP 200/i)).toBeInTheDocument();
  });

  it('Renders NO stack trace message for error events without stackTraces', async () => {
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => null);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
      body: EventFixture({type: EventOrGroupType.ERROR, entries: []}),
    });

    renderEventContext();

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
        framesOmitted: null,
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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/sentry:6b43e285de834ec5b5fe30d62d549b20/',
      body: EventFixture(errorEvent),
    });

    renderEventContext(mockedLocation);

    expect(await screen.findByTestId('stack-trace-content')).toBeInTheDocument();
  });
});
