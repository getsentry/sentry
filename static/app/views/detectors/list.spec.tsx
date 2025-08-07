import {AutomationFixture} from 'sentry-fixture/automations';
import {ErrorDetectorFixture, MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
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
import DetectorsList from 'sentry/views/detectors/list';

describe('DetectorsList', function () {
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/1/',
      body: UserFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [MetricDetectorFixture({name: 'Detector 1'})],
    });
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}), new Set());
  });

  it('displays all detector info correctly', async function () {
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
            thresholdPeriod: 10,
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
                  query: 'event.type:error',
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

    render(<DetectorsList />, {organization});
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
  });

  it('displays connected automations', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [MetricDetectorFixture({id: '1', name: 'Detector 1', workflowIds: ['100']})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [AutomationFixture({id: '100', name: 'Automation 1', detectorIds: ['1']})],
    });

    render(<DetectorsList />, {organization});
    const row = await screen.findByTestId('detector-list-row');
    expect(within(row).getByText('1 automation')).toBeInTheDocument();

    // Tooltip should fetch and display the automation name/action
    await userEvent.hover(within(row).getByText('1 automation'));
    expect(await screen.findByText('Automation 1')).toBeInTheDocument();
    expect(await screen.findByText('Slack')).toBeInTheDocument();
  });

  it('can filter by project', async function () {
    const mockDetectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [MetricDetectorFixture({name: 'Detector 1'})],
    });

    render(<DetectorsList />, {organization});

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

  describe('search', function () {
    it('can filter by type', async function () {
      const mockDetectorsRequestErrorType = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        body: [ErrorDetectorFixture({name: 'Error Detector'})],
        match: [MockApiClient.matchQuery({query: 'type:error'})],
      });

      render(<DetectorsList />, {organization});
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

    it('can filter by assignee', async function () {
      const testUser = UserFixture({id: '2', email: 'test@example.com'});
      const mockDetectorsRequestAssignee = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        body: [MetricDetectorFixture({name: 'Assigned Detector', owner: testUser.id})],
        match: [MockApiClient.matchQuery({query: 'assignee:test@example.com'})],
      });

      render(<DetectorsList />, {organization});
      await screen.findByText('Detector 1');

      // Click through menus to select assignee
      const searchInput = await screen.findByRole('combobox', {
        name: 'Add a search term',
      });
      await userEvent.type(searchInput, 'assignee:test@example.com');

      // It takes two enters. One to enter the search term, and one to submit the search.
      await userEvent.keyboard('{enter}');
      await userEvent.keyboard('{enter}');

      await screen.findByText('Assigned Detector');
      expect(mockDetectorsRequestAssignee).toHaveBeenCalled();
    });

    it('can sort the table', async function () {
      const mockDetectorsRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        body: [MetricDetectorFixture({name: 'Detector 1'})],
      });
      const {router} = render(<DetectorsList />, {organization});
      await screen.findByText('Detector 1');

      // Default sort is connectedWorkflows descending
      expect(mockDetectorsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            sortBy: '-connectedWorkflows',
          }),
        })
      );

      // Click on Name column header to sort
      await userEvent.click(screen.getByRole('columnheader', {name: 'Name'}));

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
      await userEvent.click(screen.getByRole('columnheader', {name: 'Name'}));

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
});
