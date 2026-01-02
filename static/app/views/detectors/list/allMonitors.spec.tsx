import {ActorFixture} from 'sentry-fixture/actor';
import {AutomationFixture} from 'sentry-fixture/automations';
import {ErrorDetectorFixture, MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
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
import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import AllMonitors from 'sentry/views/detectors/list/allMonitors';

describe('DetectorsList', () => {
  const organization = OrganizationFixture({
    features: ['workflow-engine-ui'],
    access: ['org:write'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/1/',
      body: UserFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [MetricDetectorFixture({name: 'Detector 1'})],
    });
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}));
  });

  it('displays all detector info correctly', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [
        MetricDetectorFixture({
          name: 'Detector 1',
          owner: null,
          type: 'metric_issue',
          config: {
            detectionType: 'percent',
            comparisonDelta: 10,
          },
          conditionGroup: {
            id: '1',
            logicType: DataConditionGroupLogicType.ALL,
            conditions: [
              {
                comparison: 10,
                conditionResult: DetectorPriorityLevel.HIGH,
                type: DataConditionType.GREATER,
                id: '1',
              },
            ],
          },
          dataSources: [
            {
              id: '1',
              organizationId: '1',
              sourceId: '1',
              type: 'snuba_query_subscription',
              queryObj: {
                snubaQuery: {
                  environment: 'production',
                  aggregate: 'count()',
                  dataset: Dataset.ERRORS,
                  id: '1',
                  query: '',
                  timeWindow: 3600,
                  eventTypes: [EventTypes.ERROR],
                },
                id: '1',
                status: 200,
                subscription: '1',
              },
            },
          ],
        }),
      ],
    });

    render(<AllMonitors />, {organization});
    await screen.findByText('Detector 1');

    const row = screen.getByTestId('detector-list-row');

    // Name
    expect(within(row).getByText('Detector 1')).toBeInTheDocument();
    // Type
    expect(within(row).getByText('Metric')).toBeInTheDocument();

    // Details under name
    expect(within(row).getByText('production')).toBeInTheDocument();
    expect(within(row).getByText('count()')).toBeInTheDocument();
    expect(within(row).getByText('event.type:error')).toBeInTheDocument();
    expect(within(row).getByText('>10% high')).toBeInTheDocument();

    // Last issue
    expect(within(row).getByText('RequestError')).toBeInTheDocument();
    expect(within(row).getByText('Last seen')).toBeInTheDocument();
  });

  it('displays connected automations', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [MetricDetectorFixture({id: '1', name: 'Detector 1', workflowIds: ['100']})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [AutomationFixture({id: '100', name: 'Automation 1', detectorIds: ['1']})],
    });

    render(<AllMonitors />, {organization});
    const row = await screen.findByTestId('detector-list-row');
    expect(within(row).getByText('1 alert')).toBeInTheDocument();

    // Tooltip should fetch and display the automation name/action
    await userEvent.hover(within(row).getByText('1 alert'));
    expect(await screen.findByText('Automation 1')).toBeInTheDocument();
    expect(await screen.findByText('Slack')).toBeInTheDocument();
  });

  it('can filter by project', async () => {
    const mockDetectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [MetricDetectorFixture({name: 'Detector 1'})],
    });

    render(<AllMonitors />, {organization});

    await screen.findByText('Detector 1');

    expect(mockDetectorsRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          project: [1],
        }),
      })
    );
  });

  describe('search', () => {
    it('can filter by type', async () => {
      const mockDetectorsRequestErrorType = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        body: [ErrorDetectorFixture({name: 'Error Detector'})],
        match: [MockApiClient.matchQuery({query: '!type:issue_stream type:error'})],
      });

      render(<AllMonitors />, {organization});
      await screen.findByText('Detector 1');

      // Click through menus to select type:error
      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.click(await screen.findByRole('option', {name: 'type'}));

      const options = await screen.findAllByRole('option');
      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('error');
      expect(options[1]).toHaveTextContent('metric');
      expect(options[2]).toHaveTextContent('cron');
      expect(options[3]).toHaveTextContent('uptime');
      await userEvent.click(screen.getByText('error'));

      await screen.findByText('Error Detector');
      expect(mockDetectorsRequestErrorType).toHaveBeenCalled();
    });

    it('can filter by assignee', async () => {
      const testUser = UserFixture({id: '2', email: 'test@example.com'});
      const mockDetectorsRequestAssignee = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        body: [
          MetricDetectorFixture({
            name: 'Assigned Detector',
            owner: ActorFixture({id: testUser.id, name: testUser.email, type: 'user'}),
          }),
        ],
        match: [
          MockApiClient.matchQuery({
            query: '!type:issue_stream assignee:test@example.com',
          }),
        ],
      });

      render(<AllMonitors />, {organization});
      await screen.findByText('Detector 1');

      // Click through menus to select assignee
      const searchInput = await screen.findByRole('combobox', {
        name: 'Add a search term',
      });
      await userEvent.type(searchInput, 'assignee:test@example.com{enter}');

      await screen.findByText('Assigned Detector');
      expect(mockDetectorsRequestAssignee).toHaveBeenCalled();
    });

    it('can sort the table', async () => {
      const mockDetectorsRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        body: [MetricDetectorFixture({name: 'Detector 1'})],
      });
      const {router} = render(<AllMonitors />, {organization});
      await screen.findByText('Detector 1');

      // Default sort is latestGroup descending
      expect(mockDetectorsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            sortBy: '-latestGroup',
          }),
        })
      );

      // Click on Name column header to sort
      await userEvent.click(
        screen.getByRole('columnheader', {name: 'Select all on page Name'})
      );

      await waitFor(() => {
        expect(mockDetectorsRequest).toHaveBeenLastCalledWith(
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
      await userEvent.click(
        screen.getByRole('columnheader', {name: 'Select all on page Name'})
      );

      await waitFor(() => {
        expect(mockDetectorsRequest).toHaveBeenLastCalledWith(
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
  });

  describe('bulk actions', () => {
    beforeEach(() => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/1/',
        body: UserFixture(),
      });
      // Set up multiple detectors with different states
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        body: [
          MetricDetectorFixture({
            id: '1',
            name: 'Enabled Detector',
            workflowIds: [],
            enabled: true,
          }),
          MetricDetectorFixture({
            id: '2',
            name: 'Disabled Detector',
            workflowIds: [],
            enabled: false,
          }),
          MetricDetectorFixture({
            id: '3',
            name: 'Another Enabled Detector',
            workflowIds: [],
            enabled: true,
          }),
        ],
      });
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}));
    });

    it('can select detectors', async () => {
      render(<AllMonitors />, {organization});
      await screen.findByText('Enabled Detector');

      const rows = screen.getAllByTestId('detector-list-row');
      expect(rows).toHaveLength(3);

      // Initially no checkboxes should be checked
      let checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });

      // Select first detector
      const firstRowCheckbox = within(rows[0]!).getByRole('checkbox');
      await userEvent.click(firstRowCheckbox);
      expect(firstRowCheckbox).toBeChecked();

      // Master checkbox should be in indeterminate state
      const masterCheckbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement; // First checkbox is the master
      expect(masterCheckbox.indeterminate).toBe(true);

      // Should not show Enable button since we have no disabled detectors selected
      expect(screen.queryByRole('button', {name: 'Enable'})).not.toBeInTheDocument();
      // Should show Disable button since we have enabled detectors selected
      expect(screen.getByRole('button', {name: 'Disable'})).toBeInTheDocument();
      // Should always show Delete button
      expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();

      // Select master checkbox to select all on page
      await userEvent.click(masterCheckbox);
      expect(masterCheckbox).toBeChecked();

      // // All checkboxes should be checked
      checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });

      // Should show Enable button since we have disabled detectors
      expect(screen.getByRole('button', {name: 'Enable'})).toBeInTheDocument();
      // Should show Disable button since we have enabled detectors
      expect(screen.getByRole('button', {name: 'Disable'})).toBeInTheDocument();
      // Should always show Delete button
      expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();
    });

    it('can enable selected detectors with confirmation', async () => {
      const updateRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        method: 'PUT',
        body: {},
      });

      render(<AllMonitors />, {organization});
      renderGlobalModal();

      await screen.findByText('Disabled Detector');

      const rows = screen.getAllByTestId('detector-list-row');
      const disabledRow = rows.find(row => within(row).queryByText('Disabled Detector'));
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
          '/organizations/org-slug/detectors/',
          expect.objectContaining({
            data: {enabled: true},
            query: {id: ['2'], query: undefined, project: undefined},
          })
        );
      });
    });

    it('can disable selected detectors with confirmation', async () => {
      const updateRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        method: 'PUT',
        body: {},
      });

      render(<AllMonitors />, {organization});
      renderGlobalModal();
      await screen.findByText('Enabled Detector');

      const rows = screen.getAllByTestId('detector-list-row');
      const enabledRow = rows.find(row => within(row).queryByText('Enabled Detector'));
      const enabledCheckbox = within(enabledRow!).getByRole('checkbox');
      await userEvent.click(enabledCheckbox);

      // Click Disable button
      await userEvent.click(screen.getByRole('button', {name: 'Disable'}));

      // Should show confirmation modal
      const confirmModal = await screen.findByRole('dialog');
      expect(
        screen.getByText(/Are you sure you want to disable this/)
      ).toBeInTheDocument();

      // Confirm the action
      await userEvent.click(within(confirmModal).getByRole('button', {name: 'Disable'}));

      await waitFor(() => {
        expect(updateRequest).toHaveBeenCalledWith(
          '/organizations/org-slug/detectors/',
          expect.objectContaining({
            data: {enabled: false},
            query: {id: ['1'], query: undefined, project: undefined},
          })
        );
      });
    });

    it('can delete selected detectors with confirmation', async () => {
      const deleteRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        method: 'DELETE',
        body: {},
      });

      render(<AllMonitors />, {organization});
      renderGlobalModal();
      await screen.findByText('Enabled Detector');

      const rows = screen.getAllByTestId('detector-list-row');
      const firstRowCheckbox = within(rows[0]!).getByRole('checkbox');
      await userEvent.click(firstRowCheckbox);

      // Click Delete button
      await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

      // Should show confirmation modal
      const confirmModal = await screen.findByRole('dialog');
      expect(
        screen.getByText(/Are you sure you want to delete this/)
      ).toBeInTheDocument();

      // Confirm the action
      await userEvent.click(within(confirmModal).getByRole('button', {name: 'Delete'}));

      await waitFor(() => {
        expect(deleteRequest).toHaveBeenCalledWith(
          '/organizations/org-slug/detectors/',
          expect.objectContaining({
            query: {id: ['1'], query: undefined, project: undefined},
          })
        );
      });
    });

    it('can not delete system-created detectors', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        body: [
          ErrorDetectorFixture({
            name: 'System Created Detector',
          }),
        ],
      });
      render(<AllMonitors />, {organization});
      await screen.findByText('System Created Detector');

      const rows = screen.getAllByTestId('detector-list-row');
      const firstRowCheckbox = within(rows[0]!).getByRole('checkbox');
      await userEvent.click(firstRowCheckbox);

      // Verify that delete button is disabled
      expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();
    });

    it('shows option to select all query results when page is selected', async () => {
      const deleteRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        method: 'DELETE',
        body: {},
      });

      render(<AllMonitors />, {organization});
      renderGlobalModal();

      const testUser = UserFixture({id: '2', email: 'test@example.com'});
      // Mock the filtered search results - this will be used when search is applied
      const filteredDetectors = Array.from({length: 20}, (_, i) =>
        MetricDetectorFixture({
          id: `filtered-${i}`,
          name: `Assigned Detector ${i + 1}`,
          owner: ActorFixture({id: testUser.id, name: testUser.email, type: 'user'}),
        })
      );

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        body: filteredDetectors,
        headers: {
          'X-Hits': '50',
        },
        match: [
          MockApiClient.matchQuery({
            query: '!type:issue_stream assignee:test@example.com',
          }),
        ],
      });

      // Click through menus to select assignee
      const searchInput = await screen.findByRole('combobox', {
        name: 'Add a search term',
      });
      await userEvent.type(searchInput, 'assignee:test@example.com{enter}');

      // Wait for filtered results to load
      await screen.findByText('Assigned Detector 1');

      const rows = screen.getAllByTestId('detector-list-row');

      // Focus on first row to make checkbox visible
      await userEvent.click(rows[0]!);
      const firstRowCheckbox = within(rows[0]!).getByRole('checkbox');
      await userEvent.click(firstRowCheckbox);
      expect(firstRowCheckbox).toBeChecked();

      // Select all on page - master checkbox should now be visible since we have a selection
      const masterCheckbox = screen.getAllByRole('checkbox')[0]!;
      await userEvent.click(masterCheckbox);

      // Should show alert with option to select all query results
      expect(screen.getByText(/20 monitors on this page selected/)).toBeInTheDocument();
      const selectAllForQuery = screen.getByRole('button', {
        name: /Select all 50 monitors that match this search query/,
      });
      await userEvent.click(selectAllForQuery);

      // Perform an action to verify query-based selection
      await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
      const confirmModal = await screen.findByRole('dialog');
      await userEvent.click(within(confirmModal).getByRole('button', {name: 'Delete'})); // Confirm

      await waitFor(() => {
        expect(deleteRequest).toHaveBeenCalledWith(
          '/organizations/org-slug/detectors/',
          expect.objectContaining({
            query: {id: undefined, query: 'assignee:test@example.com', project: [1]},
          })
        );
      });
    });

    it('disables action buttons when user does not have permissions', async () => {
      const noPermsOrganization = OrganizationFixture({
        features: ['workflow-engine-ui'],
        access: [],
      });
      render(<AllMonitors />, {organization: noPermsOrganization});
      renderGlobalModal();

      await screen.findByText('Disabled Detector');

      const rows = screen.getAllByTestId('detector-list-row');
      const disabledRow = rows.find(row => within(row).queryByText('Disabled Detector'));
      const disabledCheckbox = within(disabledRow!).getByRole('checkbox');
      await userEvent.click(disabledCheckbox);
      const enabledRow = rows.find(row => within(row).queryByText('Enabled Detector'));
      const enabledCheckbox = within(enabledRow!).getByRole('checkbox');
      await userEvent.click(enabledCheckbox);

      expect(screen.getByRole('button', {name: 'Enable'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Disable'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();
    });
  });
});
