import {initializeOrg} from 'sentry-test/initializeOrg';
import {render as baseRender, screen} from 'sentry-test/reactTestingLibrary';

import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import ReplayReader from 'sentry/utils/replays/replayReader';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

import ReplayPreview from './replayPreview';

const mockOrgSlug = 'sentry-emerging-tech';
const mockReplaySlug = 'replays:761104e184c64d439ee1014b72b4d83b';

const mockEvent = {
  ...TestStubs.Event(),
  dateCreated: '2022-09-22T16:59:41.596000Z',
};

const mockButtonHref =
  '/organizations/sentry-emerging-tech/replays/replays:761104e184c64d439ee1014b72b4d83b/?referrer=%2Forganizations%2F%3AorgId%2Fissues%2F%3AgroupId%2Freplays%2F&t=62&t_main=console';

// Mock screenfull library
jest.mock('screenfull', () => ({
  enabled: true,
  isFullscreen: false,
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

// Get replay data with the mocked replay reader params
const mockReplay = ReplayReader.factory({
  replayRecord: TestStubs.ReplayRecord({
    browser: {
      name: 'Chrome',
      version: '110.0.0',
    },
  }),
  errors: [],
  attachments: TestStubs.ReplaySegmentInit({
    timestamp: new Date('Sep 22, 2022 4:58:39 PM UTC'),
  }),
});

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
  const {router, routerContext} = initializeOrg({
    organization: {},
    project: TestStubs.Project(),
    projects: [TestStubs.Project()],
    router: {
      routes: [
        {path: '/'},
        {path: '/organizations/:orgId/issues/:groupId/'},
        {path: 'replays/'},
      ],
      location: {
        pathname: '/organizations/org-slug/replays/',
        query: {},
      },
    },
  });

  return baseRender(
    <RouteContext.Provider
      value={{
        router,
        location: router.location,
        params: router.params,
        routes: router.routes,
      }}
    >
      <OrganizationContext.Provider value={TestStubs.Organization()}>
        {children}
      </OrganizationContext.Provider>
    </RouteContext.Provider>,
    {context: routerContext}
  );
};

describe('ReplayPreview', () => {
  it('Should render a placeholder when is fetching the replay data', () => {
    // Change the mocked hook to return a loading state
    (useReplayData as jest.Mock).mockImplementationOnce(() => {
      return {
        replay: mockReplay,
        fetching: true,
      };
    });

    render(
      <ReplayPreview
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

    render(
      <ReplayPreview
        orgSlug={mockOrgSlug}
        replaySlug={mockReplaySlug}
        event={mockEvent}
      />
    );

    expect(screen.getByTestId('replay-error')).toBeVisible();
  });

  it('Should render details button when there is a replay', () => {
    render(
      <ReplayPreview
        orgSlug={mockOrgSlug}
        replaySlug={mockReplaySlug}
        event={mockEvent}
      />
    );

    const detailButton = screen.getByLabelText('Open Replay');
    expect(detailButton).toHaveAttribute('href', mockButtonHref);
  });

  it('Should render all its elements correctly', () => {
    render(
      <ReplayPreview
        orgSlug={mockOrgSlug}
        replaySlug={mockReplaySlug}
        event={mockEvent}
      />
    );

    // Expect replay view to be rendered
    expect(screen.getByText('Replays')).toBeVisible();
    expect(screen.getByTestId('player-container')).toBeInTheDocument();
  });
});
