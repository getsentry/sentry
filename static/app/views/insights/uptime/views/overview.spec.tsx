import {UptimeDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UptimeSummaryFixture} from 'sentry-fixture/uptimeSummary';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import OrganizationStore from 'sentry/stores/organizationStore';
import UptimeOverview from 'sentry/views/insights/uptime/views/overview';

jest.mock('sentry/components/pageFilters/usePageFilters');

describe('Uptime Overview', () => {
  const project = ProjectFixture();
  const team = TeamFixture();

  jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());

  beforeEach(() => {
    OrganizationStore.init();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [
        UptimeDetectorFixture({
          id: '123',
          name: 'Test Monitor',
          projectId: project.id,
          owner: undefined,
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/uptime-summary/',
      body: {
        '123': UptimeSummaryFixture(),
      },
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

  it('renders', async () => {
    const organization = OrganizationFixture();
    OrganizationStore.onUpdate(organization);

    render(<UptimeOverview />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Uptime Monitors');
  });
});
