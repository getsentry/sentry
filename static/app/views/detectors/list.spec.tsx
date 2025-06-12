import {AutomationFixture} from 'sentry-fixture/automations';
import {DetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
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
      body: [DetectorFixture({name: 'Detector 1', owner: null, type: 'metric_issue'})],
    });

    render(<DetectorsList />, {organization});
    await screen.findByText('Detector 1');

    const row = screen.getByTestId('detector-list-row');

    // Name
    expect(within(row).getByText('Detector 1')).toBeInTheDocument();
    // Type
    expect(within(row).getByText('Metric')).toBeInTheDocument();
    // Assignee should be Sentry because owner is null
    expect(within(row).getByTestId('assignee-sentry')).toBeInTheDocument();
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
  });
});
