import {render, within} from 'sentry-test/reactTestingLibrary';

import {TopBar} from 'sentry/views/navigation/topBar';

import {ContinuousProfileHeader} from './continuousProfileHeader';
import {ProfileHeader} from './profileHeader';

jest.mock('sentry/views/navigation/useHasPageFrameFeature', () => ({
  useHasPageFrameFeature: jest.fn(),
}));

jest.mock('sentry/views/profiling/profilesProvider', () => ({
  useProfiles: jest.fn(),
}));

import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useProfiles} from 'sentry/views/profiling/profilesProvider';

const mockUseHasPageFrameFeature = jest.mocked(useHasPageFrameFeature);
const mockUseProfiles = jest.mocked(useProfiles);

describe('Profiling page frame headers', () => {
  beforeEach(() => {
    mockUseProfiles.mockReturnValue({
      type: 'resolved',
      data: {
        metadata: {transactionName: 'Example Transaction'},
        profiles: [],
        shared: {},
      },
    } as any);
  });

  it('renders the transaction flamechart breadcrumbs in the top bar title slot', () => {
    mockUseHasPageFrameFeature.mockReturnValue(true);

    render(
      <div>
        <div data-testid="topbar">
          <TopBar />
        </div>
        <div data-testid="header">
          <ProfileHeader eventId="123" projectId="frontend" transaction={null} />
        </div>
      </div>,
      {
        initialRouterConfig: {
          location: {
            pathname:
              '/organizations/org-slug/profiling/profile/frontend/123/flamegraph/',
          },
        },
      }
    );

    const topbar = document.querySelector('[data-testid="topbar"]') as HTMLElement;
    const header = document.querySelector('[data-testid="header"]') as HTMLElement;

    expect(within(topbar).getByText('Profiling')).toBeInTheDocument();
    expect(within(topbar).getByText('Example Transaction')).toBeInTheDocument();
    expect(within(header).queryByText('Profiling')).not.toBeInTheDocument();
    expect(header).toBeEmptyDOMElement();
  });

  it('renders the transaction flamechart breadcrumbs inline without page frame', () => {
    mockUseHasPageFrameFeature.mockReturnValue(false);

    render(
      <div>
        <div data-testid="topbar">
          <TopBar />
        </div>
        <div data-testid="header">
          <ProfileHeader eventId="123" projectId="frontend" transaction={null} />
        </div>
      </div>,
      {
        initialRouterConfig: {
          location: {
            pathname:
              '/organizations/org-slug/profiling/profile/frontend/123/flamegraph/',
          },
        },
      }
    );

    const topbar = document.querySelector('[data-testid="topbar"]') as HTMLElement;
    const header = document.querySelector('[data-testid="header"]') as HTMLElement;

    expect(within(topbar).queryByText('Profiling')).not.toBeInTheDocument();
    expect(within(header).getByText('Profiling')).toBeInTheDocument();
    expect(within(header).getByText('Example Transaction')).toBeInTheDocument();
  });

  it('renders the continuous flamechart breadcrumbs in the top bar title slot', () => {
    mockUseHasPageFrameFeature.mockReturnValue(true);

    render(
      <div>
        <div data-testid="topbar">
          <TopBar />
        </div>
        <div data-testid="header">
          <ContinuousProfileHeader transaction={null} />
        </div>
      </div>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/profiling/profile/frontend/flamegraph/',
          },
        },
      }
    );

    const topbar = document.querySelector('[data-testid="topbar"]') as HTMLElement;
    const header = document.querySelector('[data-testid="header"]') as HTMLElement;

    expect(within(topbar).getByText('Profiling')).toBeInTheDocument();
    expect(within(header).queryByText('Profiling')).not.toBeInTheDocument();
    expect(header).toBeEmptyDOMElement();
  });

  it('renders the continuous flamechart breadcrumbs inline without page frame', () => {
    mockUseHasPageFrameFeature.mockReturnValue(false);

    render(
      <div>
        <div data-testid="topbar">
          <TopBar />
        </div>
        <div data-testid="header">
          <ContinuousProfileHeader transaction={null} />
        </div>
      </div>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/profiling/profile/frontend/flamegraph/',
          },
        },
      }
    );

    const topbar = document.querySelector('[data-testid="topbar"]') as HTMLElement;
    const header = document.querySelector('[data-testid="header"]') as HTMLElement;

    expect(within(topbar).queryByText('Profiling')).not.toBeInTheDocument();
    expect(within(header).getByText('Profiling')).toBeInTheDocument();
  });
});
