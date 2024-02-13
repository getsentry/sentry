import {duration} from 'moment';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render as baseRender, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import ReplayReader from 'sentry/utils/replays/replayReader';
import type RequestError from 'sentry/utils/requestError/requestError';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

import ReplayClipPreview from './replayClipPreview';

jest.mock('sentry/utils/replays/hooks/useReplayReader');

const mockUseReplayReader = jest.mocked(useReplayReader);

const mockOrgSlug = 'sentry-emerging-tech';
const mockReplaySlug = 'replays:761104e184c64d439ee1014b72b4d83b';
const mockReplayId = '761104e184c64d439ee1014b72b4d83b';

const mockEventTimestamp = new Date('2022-09-22T16:59:41Z');
const mockEventTimestampMs = mockEventTimestamp.getTime();

const mockButtonHref = `/organizations/${mockOrgSlug}/replays/761104e184c64d439ee1014b72b4d83b/?referrer=%2Forganizations%2F%3AorgId%2Fissues%2F%3AgroupId%2Freplays%2F&t=57&t_main=errors`;

// Get replay data with the mocked replay reader params
const mockReplay = ReplayReader.factory({
  replayRecord: ReplayRecordFixture({
    browser: {
      name: 'Chrome',
      version: '110.0.0',
    },
    started_at: new Date('Sep 22, 2022 4:58:39 PM UTC'),
    finished_at: new Date(mockEventTimestampMs + 5_000),
    duration: duration(10, 'seconds'),
  }),
  errors: [],
  attachments: RRWebInitFrameEventsFixture({
    timestamp: new Date('Sep 22, 2022 4:58:39 PM UTC'),
  }),
  clipWindow: {
    startTimestampMs: mockEventTimestampMs - 5_000,
    endTimestampMs: mockEventTimestampMs + 5_000,
  },
});

mockUseReplayReader.mockImplementation(() => {
  return {
    attachments: [],
    errors: [],
    fetchError: undefined,
    fetching: false,
    onRetry: jest.fn(),
    projectSlug: ProjectFixture().slug,
    replay: mockReplay,
    replayId: mockReplayId,
    replayRecord: ReplayRecordFixture(),
  };
});

const render: typeof baseRender = children => {
  const {router, routerContext} = initializeOrg({
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
      <OrganizationContext.Provider value={OrganizationFixture({slug: mockOrgSlug})}>
        {children}
      </OrganizationContext.Provider>
    </RouteContext.Provider>,
    {context: routerContext}
  );
};

const mockIsFullscreen = jest.fn();

jest.mock('screenfull', () => ({
  enabled: true,
  get isFullscreen() {
    return mockIsFullscreen();
  },
  request: jest.fn(),
  exit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

describe('ReplayClipPreview', () => {
  beforeEach(() => {
    mockIsFullscreen.mockReturnValue(false);

    MockApiClient.addMockResponse({
      url: '/organizations/sentry-emerging-tech/projects/',
      body: [],
    });
  });

  const defaultProps = {
    analyticsContext: '',
    orgSlug: mockOrgSlug,
    replaySlug: mockReplaySlug,
    eventTimestampMs: mockEventTimestampMs,
    clipOffsets: {
      durationAfterMs: 5_000,
      durationBeforeMs: 5_000,
    },
  };

  it('Should render a placeholder when is fetching the replay data', () => {
    // Change the mocked hook to return a loading state
    mockUseReplayReader.mockImplementationOnce(() => {
      return {
        attachments: [],
        errors: [],
        fetchError: undefined,
        fetching: true,
        onRetry: jest.fn(),
        projectSlug: ProjectFixture().slug,
        replay: mockReplay,
        replayId: mockReplayId,
        replayRecord: ReplayRecordFixture(),
      };
    });

    render(<ReplayClipPreview {...defaultProps} />);

    expect(screen.getByTestId('replay-loading-placeholder')).toBeInTheDocument();
  });

  it('Should throw error when there is a fetch error', () => {
    // Change the mocked hook to return a fetch error
    mockUseReplayReader.mockImplementationOnce(() => {
      return {
        attachments: [],
        errors: [],
        fetchError: {status: 400} as RequestError,
        fetching: false,
        onRetry: jest.fn(),
        projectSlug: ProjectFixture().slug,
        replay: null,
        replayId: mockReplayId,
        replayRecord: ReplayRecordFixture(),
      };
    });

    render(<ReplayClipPreview {...defaultProps} />);

    expect(screen.getByTestId('replay-error')).toBeVisible();
  });

  it('Should have the correct time range', () => {
    render(<ReplayClipPreview {...defaultProps} />);

    // Should be two sliders, one for the scrubber and one for timeline
    const sliders = screen.getAllByRole('slider', {name: 'Seek slider'});

    // Replay should be 10 seconds long and start at the beginning
    expect(sliders[0]).toHaveValue('0');
    expect(sliders[0]).toHaveAttribute('min', '0');
    expect(sliders[0]).toHaveAttribute('max', '10000');
  });

  it('Should link to the full replay correctly', () => {
    render(<ReplayClipPreview {...defaultProps} />);

    expect(screen.getByRole('button', {name: 'See Full Replay'})).toHaveAttribute(
      'href',
      mockButtonHref
    );
  });

  it('Display URL and breadcrumbs in fullscreen mode', async () => {
    mockIsFullscreen.mockReturnValue(true);

    render(<ReplayClipPreview {...defaultProps} />);

    // Should have URL bar
    expect(screen.getByRole('textbox', {name: 'Current URL'})).toHaveValue(
      'http://localhost:3000/'
    );

    // Breadcrumbs sidebar should be open
    expect(screen.getByTestId('replay-details-breadcrumbs-tab')).toBeInTheDocument();

    // Can close the breadcrumbs sidebar
    await userEvent.click(screen.getByRole('button', {name: 'Collapse Sidebar'}));
    expect(
      screen.queryByTestId('replay-details-breadcrumbs-tab')
    ).not.toBeInTheDocument();
  });
});
