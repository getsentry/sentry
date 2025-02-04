import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UptimeRuleFixture} from 'sentry-fixture/uptimeRule';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import UptimeOverview from 'sentry/views/insights/uptime/views/overview';

jest.mock('sentry/utils/usePageFilters');

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);
const mockNavigate = jest.fn();
mockUseNavigate.mockReturnValue(mockNavigate);

describe('Uptime Overview', function () {
  const project = ProjectFixture();
  const team = TeamFixture();

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [],
    },
  });

  beforeEach(function () {
    OrganizationStore.init();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/uptime/',
      body: [
        UptimeRuleFixture({
          name: 'Test Monitor',
          projectSlug: project.slug,
          owner: undefined,
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [team],
    });
  });

  it('renders', async function () {
    const {organization, router} = initializeOrg({
      organization: {
        features: [
          'insights-initial-modules',
          'insights-entry-points',
          'insights-uptime',
          'uptime',
        ],
      },
    });
    OrganizationStore.onUpdate(organization);

    render(<UptimeOverview />, {organization, router});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Backend');
    const tab = screen.getByRole('tab', {name: 'Uptime Monitors'});
    expect(tab).toBeInTheDocument();
    expect(tab).toHaveAttribute('aria-selected', 'true');
  });
});
