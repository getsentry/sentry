import type {ReactElement} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render as baseRender, screen} from 'sentry-test/reactTestingLibrary';

import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import ReplayReader from 'sentry/utils/replays/replayReader';
import type RequestError from 'sentry/utils/requestError/requestError';

import ReplayPreview from './replayPreview';

jest.mock('sentry/utils/replays/hooks/useLoadReplayReader');

const mockUseLoadReplayReader = jest.mocked(useLoadReplayReader);

const mockOrgSlug = 'sentry-emerging-tech';
const mockReplaySlug = 'replays:761104e184c64d439ee1014b72b4d83b';
const mockReplayId = '761104e184c64d439ee1014b72b4d83b';

const mockEventTimestampMs = new Date('2022-09-22T16:59:41Z').getTime();

const mockButtonHref = `/organizations/${mockOrgSlug}/replays/761104e184c64d439ee1014b72b4d83b/?referrer=%2Forganizations%2F%3AorgId%2Fissues%2F%3AgroupId%2Freplays%2F&t=62&t_main=errors`;

// Get replay data with the mocked replay reader params
const mockReplay = ReplayReader.factory({
  replayRecord: ReplayRecordFixture({
    browser: {
      name: 'Chrome',
      version: '110.0.0',
    },
  }),
  errors: [],
  fetching: false,
  attachments: RRWebInitFrameEventsFixture({
    timestamp: new Date('Sep 22, 2022 4:58:39 PM UTC'),
  }),
});

mockUseLoadReplayReader.mockImplementation(() => {
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

const render = (children: ReactElement) => {
  const {router} = initializeOrg({
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

  return baseRender(children, {
    router,
    organization: OrganizationFixture({slug: mockOrgSlug}),
  });
};

const defaultProps = {
  analyticsContext: '',
  orgSlug: mockOrgSlug,
  replaySlug: mockReplaySlug,
  eventTimestampMs: mockEventTimestampMs,
};

describe('ReplayPreview', () => {
  it('Should render a placeholder when is fetching the replay data', () => {
    // Change the mocked hook to return a loading state
    mockUseLoadReplayReader.mockImplementationOnce(() => {
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

    render(<ReplayPreview {...defaultProps} />);

    expect(screen.getByTestId('replay-loading-placeholder')).toBeInTheDocument();
  });

  it('Should throw error when there is a fetch error', () => {
    // Change the mocked hook to return a fetch error
    mockUseLoadReplayReader.mockImplementationOnce(() => {
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

    render(<ReplayPreview {...defaultProps} />);

    expect(screen.getByTestId('replay-error')).toBeVisible();
  });

  it('Should render details button when there is a replay', () => {
    render(<ReplayPreview {...defaultProps} />);

    const detailButton = screen.getByLabelText('Open Replay');
    expect(detailButton).toHaveAttribute('href', mockButtonHref);
  });

  it('Should render all its elements correctly', () => {
    render(<ReplayPreview {...defaultProps} />);

    // Expect replay view to be rendered
    expect(screen.getByTestId('player-container')).toBeInTheDocument();
  });
});
