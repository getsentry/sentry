import {DetectorFixture} from 'sentry-fixture/detectors';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import DetectorsList from 'sentry/views/detectors/list';

describe('DetectorsList', function () {
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
  });

  it('can filter by project', async function () {
    const mockDetectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [DetectorFixture({name: 'Detector 1'})],
    });

    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}), new Set());

    render(<DetectorsList />);

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

      render(<DetectorsList />);
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
