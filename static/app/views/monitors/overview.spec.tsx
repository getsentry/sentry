import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import {useNavigate} from 'sentry/utils/useNavigate';
import Monitors from 'sentry/views/monitors/overview';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);
const mockNavigate = jest.fn();
mockUseNavigate.mockReturnValue(mockNavigate);

describe('Monitors Overview', function () {
  const team = TeamFixture();

  beforeEach(function () {
    OrganizationStore.init();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/monitors/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/processing-errors/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
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
    const {organization, router} = initializeOrg();
    OrganizationStore.onUpdate(organization);

    render(<Monitors />, {organization, router});
    expect(await screen.findByText('Cron Monitors')).toBeInTheDocument();
  });

  it('correctly filters on owner', async function () {
    const {organization, router} = initializeOrg({
      router: {location: {query: {cursor: 'test-cursor'}}},
    });
    OrganizationStore.onUpdate(organization);

    render(<Monitors />, {organization, router});
    expect(await screen.findByText('Cron Monitors')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Filter Owners'}));
    await userEvent.click(screen.getByRole('option', {name: '#team-slug'}));

    expect(mockNavigate).toHaveBeenLastCalledWith(
      {
        query: {
          cursor: undefined, // Confirm that the cursor is reset
          owner: ['team:1'],
        },
      },
      {replace: true}
    );
  });
});
