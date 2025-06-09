import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render as baseRender, screen} from 'sentry-test/reactTestingLibrary';

import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import type {Organization} from 'sentry/types/organization';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import type RequestError from 'sentry/utils/requestError/requestError';

const render = (children: React.ReactElement, orgParams: Partial<Organization> = {}) => {
  const {organization} = initializeOrg({
    organization: {slug: 'test-org', ...orgParams},
  });

  return baseRender(children, {
    organization,
  });
};

describe('ReplayLoadingState', () => {
  const defaultProps = {
    children: jest.fn(() => <div data-testid="replay-content">Replay Content</div>),
    readerResult: {
      attachments: [],
      errors: [],
      fetchError: undefined,
      attachmentError: undefined,
      fetching: false,
      onRetry: jest.fn(),
      projectSlug: 'test-project',
      replay: null,
      replayId: 'test-replay-id',
      replayRecord: undefined,
    } as ReturnType<typeof useLoadReplayReader>,
  };

  it('should show loading state when fetching is true', () => {
    const propsWithFetching = {
      ...defaultProps,
      readerResult: {
        ...defaultProps.readerResult,
        fetching: true,
      },
    };

    render(<ReplayLoadingState {...propsWithFetching} />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('should show loading state when essential data is missing even if fetching is false', () => {
    // Missing replayRecord
    const propsWithMissingData = {
      ...defaultProps,
      readerResult: {
        ...defaultProps.readerResult,
        fetching: false,
        attachments: [],
        errors: [],
        replayRecord: undefined, // This is missing
      },
    };

    render(<ReplayLoadingState {...propsWithMissingData} />);

    // Should show loading indicator because essential data is missing
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should show loading state when attachments are missing', () => {
    const propsWithMissingAttachments = {
      ...defaultProps,
      readerResult: {
        ...defaultProps.readerResult,
        fetching: false,
        attachments: undefined, // This is missing
        errors: [],
        replayRecord: {id: 'test'} as any,
      },
    };

    render(<ReplayLoadingState {...propsWithMissingAttachments} />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should show error state when fetch error exists and fetching is false', () => {
    const propsWithFetchError = {
      ...defaultProps,
      readerResult: {
        ...defaultProps.readerResult,
        fetchError: {status: 400} as RequestError,
        fetching: false,
      },
    };

    render(<ReplayLoadingState {...propsWithFetchError} />);

    // Should show error alert since we have a real fetch error
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('should prioritize loading state over fetch error when fetching is true', () => {
    const propsWithFetchErrorButStillFetching = {
      ...defaultProps,
      readerResult: {
        ...defaultProps.readerResult,
        fetchError: {status: 400} as RequestError,
        fetching: true, // This takes priority
      },
    };

    render(<ReplayLoadingState {...propsWithFetchErrorButStillFetching} />);

    // Should show loading indicator, not error message
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should render children when replay is available and all data is ready', () => {
    const mockReplay = {
      hasProcessingErrors: jest.fn(() => false),
    };

    const propsWithReplay = {
      ...defaultProps,
      readerResult: {
        ...defaultProps.readerResult,
        replay: mockReplay as any,
        fetching: false,
        attachments: ['some-attachment'],
        errors: [],
        replayRecord: {id: 'test'} as any,
      },
    };

    render(<ReplayLoadingState {...propsWithReplay} />);

    expect(screen.getByTestId('replay-content')).toBeInTheDocument();
    expect(defaultProps.children).toHaveBeenCalledWith({replay: mockReplay});
  });
});
