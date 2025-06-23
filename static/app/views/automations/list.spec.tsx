import {AutomationFixture} from 'sentry-fixture/automations';
import {DetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import AutomationsList from 'sentry/views/automations/list';

describe('AutomationsList', function () {
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/1/',
      body: UserFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [AutomationFixture({name: 'Automation 1'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/1/',
      body: [DetectorFixture({name: 'Detector 1'})],
    });
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}), new Set());
  });

  it('displays all automation info correctly', async function () {
    render(<AutomationsList />, {organization});
    await screen.findByText('Automation 1');

    const row = screen.getByTestId('automation-list-row');

    // Name
    expect(within(row).getByText('Automation 1')).toBeInTheDocument();
    // Action
    expect(within(row).getByText('Slack')).toBeInTheDocument();
    // Monitors
    expect(within(row).getByText('1 monitor')).toBeInTheDocument();
  });

  it('displays connected detectors', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [AutomationFixture({id: '100', name: 'Automation 1', detectorIds: ['1']})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [
        DetectorFixture({
          id: '1',
          name: 'Detector 1',
          workflowIds: ['100'],
          projectId: '1',
        }),
      ],
      match: [MockApiClient.matchQuery({id: ['1']})],
    });
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'project-1'})]);

    render(<AutomationsList />, {organization});
    const row = await screen.findByTestId('automation-list-row');
    expect(within(row).getByText('1 monitor')).toBeInTheDocument();

    // Tooltip should fetch and display the detector name and project
    await userEvent.hover(within(row).getByText('1 monitor'));
    expect(await screen.findByRole('link', {name: /Detector 1/})).toBeInTheDocument();
    expect(await screen.findByText('project-1')).toBeInTheDocument();
  });

  it('can filter by project', async function () {
    const mockAutomationsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [AutomationFixture({name: 'Automation 1'})],
    });

    render(<AutomationsList />, {organization});

    await screen.findByText('Automation 1');

    expect(mockAutomationsRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          project: [1],
        }),
      })
    );
  });

  it('can sort the table', async function () {
    const mockAutomationsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [AutomationFixture({name: 'Automation 1'})],
    });
    const {router} = render(<AutomationsList />, {organization});
    await screen.findByText('Automation 1');

    // Default sort is connectedWorkflows descending
    expect(mockAutomationsRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          sortBy: '-connectedDetectors',
        }),
      })
    );

    // Click on Name column header to sort
    await userEvent.click(screen.getByRole('columnheader', {name: 'Name'}));

    await waitFor(() => {
      expect(mockAutomationsRequest).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            sortBy: 'name',
          }),
        })
      );
    });
    expect(router.location.query.sort).toBe('name');

    // Click on Name column header again to change sort direction
    await userEvent.click(screen.getByRole('columnheader', {name: 'Name'}));

    await waitFor(() => {
      expect(mockAutomationsRequest).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            sortBy: '-name',
          }),
        })
      );
    });
    expect(router.location.query.sort).toBe('-name');
  });

  describe('search', function () {
    it('can filter by action', async function () {
      const mockAutomationActionSlack = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/',
        body: [AutomationFixture({name: 'Slack Automation'})],
        match: [MockApiClient.matchQuery({query: 'action:slack'})],
      });

      render(<AutomationsList />, {organization});
      await screen.findByText('Automation 1');

      // Click through menus to select action:slack
      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.click(await screen.findByRole('option', {name: 'action'}));
      await userEvent.click(await screen.findByRole('option', {name: 'slack'}));

      await screen.findByText('Slack Automation');
      expect(mockAutomationActionSlack).toHaveBeenCalled();
    });
  });
});
