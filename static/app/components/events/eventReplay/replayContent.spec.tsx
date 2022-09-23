import {render, screen} from 'sentry-test/reactTestingLibrary';

import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import {MemorySpanType, ReplaySpan} from 'sentry/views/replays/types';

import ReplayContent from './replayContent';

const mockOrgSlug = 'sentry-emerging-tech';
const mockReplaySlug = 'replays:761104e184c64d439ee1014b72b4d83b';

const mockStartedAt = 'Sep 20, 2022 2:20:08 PM UTC';
const mockFinishedAt = 'Sep 20, 2022 2:20:32 PM UTC';

const mockReplayDuration = 24; // 24 seconds

const mockEvent = {
  ...TestStubs.Event(),
  dateCreated: '2022-09-20T14:20:17.371000Z',
};

const mockButtonHref =
  '/organizations/sentry-emerging-tech/replays/replays:761104e184c64d439ee1014b72b4d83b/?t=9.371&t_main=console';

// Mock screenfull library
jest.mock('screenfull', () => ({
  enabled: true,
  isFullscreen: false,
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

// Mock replay object with the params we need
const mockReplay = {
  replayRecord: {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    title: '',
    projectId: '6273278',
    platform: 'javascript',
    releases: ['1.0.0', '2.0.0'],
    dist: '',
    traceIds: [],
    errorIds: ['5c83aaccfffb4a708ae893bad9be3a1c'],
    startedAt: new Date(mockStartedAt),
    finishedAt: new Date(mockFinishedAt),
    duration: mockReplayDuration,
    countSegments: 14,
    countErrors: 1,
    id: '761104e184c64d439ee1014b72b4d83b',
    longestTransaction: 0,
    environment: 'demo',
    tags: {},
    user: {
      id: '',
      name: '',
      email: '',
      ip_address: '127.0.0.1',
      displayName: '127.0.0.1',
    },
    sdk: {
      name: 'sentry.javascript.browser',
      version: '7.1.1',
    },
    os: {
      name: 'Other',
      version: '',
    },
    browser: {
      name: 'Other',
      version: '',
    },
    device: {
      name: '',
      brand: '',
      model: '',
      family: 'Other',
    },
    urls: ['http://localhost:3000/'],
    countUrls: 1,
  },
  rrwebEvents: [
    {
      type: 0,
      data: {},
      timestamp: 1663847686000,
      delay: -198487,
    },
    {
      type: 1,
      data: {},
      timestamp: 1663847749288,
      delay: -135199,
    },
    {
      type: 4,
      data: {
        href: 'https://sourcemaps.io/',
        width: 1536,
        height: 722,
      },
      timestamp: 1663847749288,
      delay: -135199,
    },
  ],
  breadcrumbs: [
    {
      timestamp: 1663847751.886,
      type: 'default',
      category: 'ui.focus',
    },
    {
      timestamp: 1663847765.355,
      type: 'default',
      category: 'ui.click',
      message:
        'input.form-control[type="text"][name="url"][title="Fully qualified URL prefixed with http or https"]',
      data: {
        nodeId: 37,
      },
    },
  ],
  spans: [
    {
      op: 'navigation.navigate',
      description: 'https://sourcemaps.io/',
      startTimestamp: 1663847686.6915,
      endTimestamp: 1663847749.2882,
      data: {
        size: 4731,
        duration: 62615.89999997616,
      },
    },
    {
      op: 'navigation.navigate',
      description: 'https://sourcemaps.io/',
      startTimestamp: 1663847686.6915,
      endTimestamp: 1663847749.2882,
      data: {
        size: 4731,
        duration: 62615.89999997616,
      },
    },
  ],
  errors: [],
  getDurationMs: function () {
    return this.replayRecord.duration * 1000;
  },

  getReplay: function () {
    return this.replayRecord;
  },

  getRRWebEvents: function () {
    return this.rrwebEvents;
  },

  getRawCrumbs: function () {
    return this.breadcrumbs;
  },

  getRawSpans: function () {
    return this.spans;
  },

  isMemorySpan: function (span: ReplaySpan): span is MemorySpanType {
    return span.op === 'memory';
  },

  isNetworkSpan: function (span: ReplaySpan) {
    return !this.isMemorySpan(span) && !span.op.includes('paint');
  },
};

// Mock useReplayData hook to return the mocked replay data
jest.mock('sentry/utils/replays/hooks/useReplayData', () => {
  return {
    __esModule: true,
    default: jest.fn(() => {
      return {
        replay: mockReplay,
        fetching: false,
      };
    }),
  };
});

describe('ReplayContent', () => {
  it('Should render a placeholder when is fetching the replay data', () => {
    // Change the mocked hook to return a loading state
    (useReplayData as jest.Mock).mockImplementationOnce(() => {
      return {
        replay: mockReplay,
        fetching: true,
      };
    });

    render(
      <ReplayContent
        orgSlug={mockOrgSlug}
        replaySlug={mockReplaySlug}
        event={mockEvent}
      />
    );

    expect(screen.getByTestId('replay-loading-placeholder')).toBeInTheDocument();
  });

  it('Should throw error when there is a fetch error', () => {
    // Change the mocked hook to return a fetch error
    (useReplayData as jest.Mock).mockImplementationOnce(() => {
      return {
        replay: null,
        fetching: false,
        fetchError: {status: 400},
      };
    });

    expect(() =>
      render(
        <ReplayContent
          orgSlug={mockOrgSlug}
          replaySlug={mockReplaySlug}
          event={mockEvent}
        />
      )
    ).toThrow();
  });

  it('Should render details button when there is a replay', () => {
    render(
      <ReplayContent
        orgSlug={mockOrgSlug}
        replaySlug={mockReplaySlug}
        event={mockEvent}
      />,
      {context: TestStubs.routerContext()}
    );

    const detailButton = screen.getByTestId('replay-details-button');
    expect(detailButton).toBeInTheDocument();

    // Expect the details button to have the correct href
    expect(detailButton).toHaveAttribute('href', mockButtonHref);
  });

  it('Should render all its elements correctly', () => {
    render(
      <ReplayContent
        orgSlug={mockOrgSlug}
        replaySlug={mockReplaySlug}
        event={mockEvent}
      />
    );

    // Expect replay view to be rendered
    expect(screen.getAllByText('Replay')).toHaveLength(2);
    expect(screen.getByTestId('player-container')).toBeInTheDocument();

    // Expect Id to be correct
    expect(screen.getByText('Id')).toBeInTheDocument();
    expect(screen.getByTestId('replay-id')).toHaveTextContent(
      mockReplay?.getReplay?.().id ?? ''
    );

    // Expect Duration value to be correct
    expect(screen.getByText('URL')).toBeInTheDocument();
    expect(screen.getByTestId('replay-duration')).toHaveTextContent('24 seconds');

    // Expect Timestamp value to be correct
    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByTestId('replay-timestamp')).toHaveTextContent(mockStartedAt);

    // Expect the URL value to be correct
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByTestId('replay-url')).toHaveTextContent(
      mockReplay?.getReplay?.().urls[0] ?? ''
    );
  });
});
