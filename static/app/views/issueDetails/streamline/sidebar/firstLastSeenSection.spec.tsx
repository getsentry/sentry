import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useFetchAllEnvsGroupData} from 'sentry/views/issueDetails/groupSidebar';
import FirstLastSeenSection from 'sentry/views/issueDetails/streamline/sidebar/firstLastSeenSection';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

jest.mock('sentry/views/issueDetails/utils', () => ({
  useEnvironmentsFromUrl: jest.fn(),
}));
jest.mock('sentry/views/issueDetails/groupSidebar', () => ({
  useFetchAllEnvsGroupData: jest.fn(),
}));

const mockUseEnvironmentsFromUrl = useEnvironmentsFromUrl as jest.MockedFunction<
  typeof useEnvironmentsFromUrl
>;
const mockUseFetchAllEnvsGroupData = useFetchAllEnvsGroupData as jest.MockedFunction<
  typeof useFetchAllEnvsGroupData
>;

describe('FirstLastSeenSection', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const group = GroupFixture({
    project,
    firstSeen: '2024-01-06T10:00:00Z',
    lastSeen: '2024-01-14T12:00:00Z',
  });

  const firstRelease = ReleaseFixture({version: '1.0.0'});
  const lastRelease = ReleaseFixture({version: '1.1.0'});

  let mockFirstLastRelease: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseEnvironmentsFromUrl.mockReturnValue([]);
    mockUseFetchAllEnvsGroupData.mockReturnValue({
      data: GroupFixture({
        firstSeen: '2024-01-06T10:00:00Z',
        lastSeen: '2024-01-14T12:00:00Z',
      }),
      isError: false,
      error: null,
      isPending: false,
      isLoading: false,
      isSuccess: true,
      isFetching: false,
      isRefetching: false,
      isStale: false,
      refetch: jest.fn(),
    } as any);

    MockApiClient.clearMockResponses();

    mockFirstLastRelease = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      method: 'GET',
      body: {
        id: group.id,
        firstRelease,
        lastRelease,
      },
    });
  });

  it('renders first and last seen information with release data', async () => {
    render(<FirstLastSeenSection group={group} />, {organization});

    await waitFor(() => {
      expect(mockFirstLastRelease).toHaveBeenCalled();
    });

    expect(mockFirstLastRelease).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      expect.objectContaining({
        query: {},
      })
    );

    expect(await screen.findByText('First seen')).toBeInTheDocument();
    expect(screen.getByText('Last seen')).toBeInTheDocument();

    expect(
      await screen.findByText((_content, element) => {
        return element?.textContent === 'in release 1.0.0';
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        return element?.textContent === 'in release 1.1.0';
      })
    ).toBeInTheDocument();
  });

  it('calls API with environment parameters when environments are selected', async () => {
    mockUseEnvironmentsFromUrl.mockReturnValue(['production', 'staging']);

    render(<FirstLastSeenSection group={group} />, {organization});

    await waitFor(() => {
      expect(mockFirstLastRelease).toHaveBeenCalled();
    });

    expect(mockFirstLastRelease).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      expect.objectContaining({
        query: {
          environment: ['production', 'staging'],
        },
      })
    );
  });

  it('shows environment-specific release information', async () => {
    const productionRelease = ReleaseFixture({version: '1.0.0'});

    mockUseEnvironmentsFromUrl.mockReturnValue(['production']);
    mockFirstLastRelease = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      method: 'GET',
      body: {
        id: group.id,
        firstRelease: productionRelease,
        lastRelease: productionRelease,
      },
    });

    render(<FirstLastSeenSection group={group} />, {organization});

    const releaseTexts = await screen.findAllByText((_content, element) => {
      return element?.textContent === 'in release 1.0.0';
    });
    expect(releaseTexts).toHaveLength(2);
  });

  it('handles missing release data gracefully', async () => {
    mockFirstLastRelease = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      method: 'GET',
      body: {
        id: group.id,
        firstRelease: null,
        lastRelease: null,
      },
    });

    render(<FirstLastSeenSection group={group} />, {organization});

    expect(await screen.findByText('First seen')).toBeInTheDocument();
    expect(screen.getByText('Last seen')).toBeInTheDocument();
    expect(screen.queryByText(/in release/)).not.toBeInTheDocument();
  });
});
