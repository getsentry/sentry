import {AutomationFixture} from 'sentry-fixture/automations';
import {DetectorFixture} from 'sentry-fixture/detectors';
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
      body: [DetectorFixture({name: 'Detector 1'})],
    });
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}), new Set());
  });

  it('displays all detector info correctly', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [
        DetectorFixture({
          name: 'Detector 1',
          owner: null,
          type: 'metric_issue',
          config: {
            detection_type: 'percent',
            comparison_delta: 10,
            threshold_period: 10,
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
                  dataset: 'events',
                  id: '1',
                  query: 'event.type:error',
                  timeWindow: 3600,
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
      body: [DetectorFixture({id: '1', name: 'Detector 1', workflowIds: ['100']})],
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
      body: [DetectorFixture({name: 'Detector 1'})],
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
        body: [DetectorFixture({type: 'error', name: 'Error Detector'})],
        match: [MockApiClient.matchQuery({query: 'type:error'})],
      });

      render(<DetectorsList />, {organization});
      await screen.findByText('Detector 1');

      // Click through menus to select type:error
      await userEvent.click(screen.getByRole('combobox', {name: 'Add a search term'}));
      await userEvent.click(await screen.findByRole('option', {name: 'type'}));
      const options = await screen.findAllByRole('option');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent('error');
      expect(options[1]).toHaveTextContent('metric_issue');
      expect(options[2]).toHaveTextContent('uptime_domain_failure');
      await userEvent.click(screen.getByText('error'));

      await screen.findByText('Error Detector');
      expect(mockDetectorsRequestErrorType).toHaveBeenCalled();
    });

    it('can sort the table', async function () {
      const mockDetectorsRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/detectors/',
        body: [DetectorFixture({name: 'Detector 1'})],
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
