import {render, screen} from 'sentry-test/reactTestingLibrary';

import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import ReplayReader from 'sentry/utils/replays/replayReader';

import ReplayContent from './replayContent';

const testOrgSlug = 'sentry-emerging-tech';
const testReplaySlug = 'replays:761104e184c64d439ee1014b72b4d83b';

// Mock screenfull library
jest.mock('screenfull', () => ({
  enabled: true,
  isFullscreen: false,
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

// Mock replay object with the props we need for ReplayContent
const mockedReplay: Partial<ReplayReader> = {
  getReplay: () => ({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    title: '',
    projectId: '6273278',
    platform: 'javascript',
    releases: ['1.0.0', '2.0.0'],
    dist: '',
    traceIds: [],
    errorIds: ['5c83aaccfffb4a708ae893bad9be3a1c'],
    startedAt: new Date(),
    finishedAt: new Date(),
    duration: 670,
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
      ip_address: '73.241.205.8',
      displayName: '73.241.205.8',
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
  }),
  getRRWebEvents: () => [
    {
      type: 4,
      data: {
        href: 'http://localhost:3000/',
        width: 1536,
        height: 824,
      },
      timestamp: 1663025353247,
    },
    {
      type: 4,
      data: {
        href: 'http://localhost:3000/',
        width: 1536,
        height: 151,
      },
      timestamp: 1663025450243,
    },
  ],
  getDurationMs() {
    return 670 * 1000;
  },
};

// Mock useReplayData hook to return the mocked replay data
jest.mock('sentry/utils/replays/hooks/useReplayData', () => {
  return {
    __esModule: true,
    default: jest.fn(() => {
      return {
        replay: mockedReplay,
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
        replay: mockedReplay,
        fetching: true,
      };
    });

    render(<ReplayContent orgSlug={testOrgSlug} replaySlug={testReplaySlug} />);

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
      render(<ReplayContent orgSlug={testOrgSlug} replaySlug={testReplaySlug} />)
    ).toThrow();
  });

  it('Should render all its elements correctly', () => {
    render(<ReplayContent orgSlug={testOrgSlug} replaySlug={testReplaySlug} />);

    // Expect replay view to be rendered
    expect(screen.getByText('Replay')).toBeInTheDocument();
    expect(screen.getByTestId('player-container')).toBeInTheDocument();

    // Expect Id to be correct
    expect(screen.getByText('Id')).toBeInTheDocument();
    expect(screen.getByTestId('replay-id')).toHaveTextContent(
      '761104e184c64d439ee1014b72b4d83b'
    );

    // Expect Duration value to be correct
    expect(screen.getByText('URL')).toBeInTheDocument();
    expect(screen.getByTestId('replay-duration')).toHaveTextContent('11 minutes');

    // Expect Timestamp value to be correct
    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByTestId('replay-timestamp')).toHaveTextContent(
      'Oct 17, 2017 2:41:20 AM UTC'
    );

    // Expect the URL value to be correct
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByTestId('replay-url')).toHaveTextContent('http://localhost:3000/');
  });
});
