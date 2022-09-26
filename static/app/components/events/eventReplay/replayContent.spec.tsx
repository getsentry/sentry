import {render as baseRender, screen} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import ReplayReader, {ReplayReaderParams} from 'sentry/utils/replays/replayReader';
import {OrganizationContext} from 'sentry/views/organizationContext';

import ReplayContent from './replayContent';

const mockOrgSlug = 'sentry-emerging-tech';
const mockReplaySlug = 'replays:761104e184c64d439ee1014b72b4d83b';

const mockStartedAt = 'Sep 22, 2022 4:58:39 PM UTC';
const mockFinishedAt = 'Sep 22, 2022 5:00:03 PM UTC';

const mockReplayDuration = 84; // seconds

const mockEvent = {
  ...TestStubs.Event(),
  dateCreated: '2022-09-22T16:59:41.596000Z',
};

const mockButtonHref =
  '/organizations/sentry-emerging-tech/replays/replays:761104e184c64d439ee1014b72b4d83b/?t=62&t_main=console';

// Mock screenfull library
jest.mock('screenfull', () => ({
  enabled: true,
  isFullscreen: false,
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

// Mock replay reader params object with the data we need
const mockReplayReaderParams: ReplayReaderParams = {
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
      timestamp: 1663865919000,
      delay: -198487,
    },
    {
      type: 1,
      data: {},
      timestamp: 1663865920587,
      delay: -135199,
    },
    {
      type: 4,
      data: {
        href: 'http://localhost:3000/',
        width: 1536,
        height: 722,
      },
      timestamp: 1663865920587,
      delay: -135199,
    },
  ],
  breadcrumbs: [
    {
      timestamp: 1663865920.851,
      type: BreadcrumbType.DEFAULT,
      level: BreadcrumbLevelType.INFO,
      category: 'ui.focus',
    },
    {
      timestamp: 1663865922.024,
      type: BreadcrumbType.DEFAULT,
      level: BreadcrumbLevelType.INFO,
      category: 'ui.click',
      message:
        'input.form-control[type="text"][name="url"][title="Fully qualified URL prefixed with http or https"]',
      data: {
        nodeId: 37,
      },
    },
  ],
  spans: [],
  errors: [],
};

// Get replay data with the mocked replay reader params
const mockReplay = ReplayReader.factory(mockReplayReaderParams);

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

const render: typeof baseRender = children => {
  return baseRender(
    <OrganizationContext.Provider value={TestStubs.Organization()}>
      {children}
    </OrganizationContext.Provider>,
    {context: TestStubs.routerContext()}
  );
};

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
      />
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
    expect(screen.getByTestId('replay-duration')).toHaveTextContent('1 minute');

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
