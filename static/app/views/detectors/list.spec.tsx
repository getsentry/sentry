import {DetectorFixture} from 'sentry-fixture/detectors';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
});
