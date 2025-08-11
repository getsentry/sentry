import {AutomationFixture} from 'sentry-fixture/automations';
import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
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
      body: [MetricDetectorFixture({name: 'Detector 1'})],
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
        MetricDetectorFixture({
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
          sortBy: '-lastTriggered',
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

  describe('bulk actions', function () {
    beforeEach(function () {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/1/',
        body: UserFixture(),
      });
      // Set up multiple automations with different states
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/',
        body: [
          AutomationFixture({
            id: '1',
            name: 'Enabled Automation',
            detectorIds: [],
            enabled: true,
          }),
          AutomationFixture({
            id: '2',
            name: 'Disabled Automation',
            detectorIds: [],
            enabled: false,
          }),
          AutomationFixture({
            id: '3',
            name: 'Another Enabled',
            detectorIds: [],
            enabled: true,
          }),
        ],
      });
      PageFiltersStore.onInitializeUrlState(
        PageFiltersFixture({projects: [1]}),
        new Set()
      );
    });

    it('can select automations', async function () {
      render(<AutomationsList />, {organization});
      await screen.findByText('Enabled Automation');

      const rows = screen.getAllByTestId('automation-list-row');
      expect(rows).toHaveLength(3);

      // Initially no checkboxes should be checked
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });

      // Select first automation
      const firstRowCheckbox = within(rows[0]!).getByRole('checkbox');
      await userEvent.click(firstRowCheckbox);
      expect(firstRowCheckbox).toBeChecked();

      // Master checkbox should be in indeterminate state
      const masterCheckbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement; // First checkbox is the master
      expect(masterCheckbox.indeterminate).toBe(true);

      // Should not show Enable button since we have no disabled automations selected
      expect(screen.queryByRole('button', {name: 'Enable'})).not.toBeInTheDocument();
      // Should show Disable button since we have enabled automations selected
      expect(screen.getByRole('button', {name: 'Disable'})).toBeInTheDocument();
      // Should always show Delete button
      expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();

      // Select master checkbox to select all on page
      await userEvent.click(masterCheckbox);
      expect(masterCheckbox).toBeChecked();

      // // All checkboxes should be checked
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });

      // Should show Enable button since we have disabled automations
      expect(screen.getByRole('button', {name: 'Enable'})).toBeInTheDocument();
      // Should show Disable button since we have enabled automations
      expect(screen.getByRole('button', {name: 'Disable'})).toBeInTheDocument();
      // Should always show Delete button
      expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();
    });

    it('can enable selected automations with confirmation', async function () {
      const updateRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/',
        method: 'PUT',
        body: {},
      });

      render(<AutomationsList />, {organization});
      renderGlobalModal();

      await screen.findByText('Disabled Automation');

      const rows = screen.getAllByTestId('automation-list-row');
      const disabledRow = rows.find(row =>
        within(row).queryByText('Disabled Automation')
      );
      const disabledCheckbox = within(disabledRow!).getByRole('checkbox');
      await userEvent.click(disabledCheckbox);

      // Click Enable button
      await userEvent.click(screen.getByRole('button', {name: 'Enable'}));

      // Should show confirmation modal
      const confirmModal = screen.getByRole('dialog');
      expect(
        screen.getByText(/Are you sure you want to enable this/)
      ).toBeInTheDocument();

      // Confirm the action
      await userEvent.click(within(confirmModal).getByRole('button', {name: 'Enable'}));

      await waitFor(() => {
        expect(updateRequest).toHaveBeenCalledWith(
          '/organizations/org-slug/workflows/',
          expect.objectContaining({
            data: {enabled: true},
            query: {id: ['2'], query: undefined, project: undefined},
          })
        );
      });
    });

    it('can disable selected automations with confirmation', async function () {
      const updateRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/',
        method: 'PUT',
        body: {},
      });

      render(<AutomationsList />, {organization});
      renderGlobalModal();
      await screen.findByText('Enabled Automation');

      const rows = screen.getAllByTestId('automation-list-row');
      const enabledRow = rows.find(row => within(row).queryByText('Enabled Automation'));
      const enabledCheckbox = within(enabledRow!).getByRole('checkbox');
      await userEvent.click(enabledCheckbox);

      // Click Disable button
      await userEvent.click(screen.getByRole('button', {name: 'Disable'}));

      // Should show confirmation modal
      const confirmModal = screen.getByRole('dialog');
      expect(
        screen.getByText(/Are you sure you want to disable this/)
      ).toBeInTheDocument();

      // Confirm the action
      await userEvent.click(within(confirmModal).getByRole('button', {name: 'Disable'}));

      await waitFor(() => {
        expect(updateRequest).toHaveBeenCalledWith(
          '/organizations/org-slug/workflows/',
          expect.objectContaining({
            data: {enabled: false},
            query: {id: ['1'], query: undefined, project: undefined},
          })
        );
      });
    });

    it('can delete selected automations with confirmation', async function () {
      const deleteRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/',
        method: 'DELETE',
        body: {},
      });

      render(<AutomationsList />, {organization});
      renderGlobalModal();
      await screen.findByText('Enabled Automation');

      const rows = screen.getAllByTestId('automation-list-row');
      const firstRowCheckbox = within(rows[0]!).getByRole('checkbox');
      await userEvent.click(firstRowCheckbox);

      // Click Delete button
      await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

      // Should show confirmation modal
      const confirmModal = screen.getByRole('dialog');
      expect(
        screen.getByText(/Are you sure you want to delete this/)
      ).toBeInTheDocument();

      // Confirm the action
      await userEvent.click(within(confirmModal).getByRole('button', {name: 'Delete'}));

      await waitFor(() => {
        expect(deleteRequest).toHaveBeenCalledWith(
          '/organizations/org-slug/workflows/',
          expect.objectContaining({
            query: {id: ['1'], query: undefined, project: undefined},
          })
        );
      });
    });

    it('shows option to select all query results when page is selected', async function () {
      const deleteRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/',
        method: 'DELETE',
        body: {},
      });

      render(<AutomationsList />, {organization});
      renderGlobalModal();

      // Mock the filtered search results - this will be used when search is applied
      const filteredAutomations = Array.from({length: 20}, (_, i) =>
        AutomationFixture({
          id: `filtered-${i}`,
          name: `Slack Automation ${i + 1}`,
          enabled: i % 2 === 0,
          detectorIds: [],
        })
      );

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/workflows/',
        method: 'GET',
        body: filteredAutomations,
        headers: {
          'X-Hits': '50',
        },
        match: [
          MockApiClient.matchQuery({
            query: 'action:slack',
            project: [1],
          }),
        ],
      });

      // Click through menus to select action:slack
      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.click(await screen.findByRole('option', {name: 'action'}));
      await userEvent.click(await screen.findByRole('option', {name: 'slack'}));

      // Wait for filtered results to load
      await screen.findByText('Slack Automation 1');

      const rows = screen.getAllByTestId('automation-list-row');

      // Focus on first row to make checkbox visible
      await userEvent.click(rows[0]!);
      const firstRowCheckbox = within(rows[0]!).getByRole('checkbox');
      await userEvent.click(firstRowCheckbox);
      expect(firstRowCheckbox).toBeChecked();

      // Select all on page - master checkbox should now be visible since we have a selection
      const masterCheckbox = screen.getAllByRole('checkbox')[0]!;
      await userEvent.click(masterCheckbox);

      // Should show alert with option to select all query results
      expect(
        screen.getByText(/20 automations on this page selected/)
      ).toBeInTheDocument();
      const selectAllForQuery = screen.getByText(
        /Select all 50 automations that match this search query/
      );
      await userEvent.click(selectAllForQuery);

      // Perform an action to verify query-based selection
      await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
      const confirmModal = screen.getByRole('dialog');
      await userEvent.click(within(confirmModal).getByRole('button', {name: 'Delete'})); // Confirm

      await waitFor(() => {
        expect(deleteRequest).toHaveBeenCalledWith(
          '/organizations/org-slug/workflows/',
          expect.objectContaining({
            query: {id: undefined, query: 'action:slack', project: [1]},
          })
        );
      });
    });
  });
});
