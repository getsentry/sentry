import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MetricSearchBar} from 'sentry/components/metrics/metricSearchBar';

describe('metricSearchBar', function () {
  const onChange = jest.fn();
  beforeEach(() => {
    onChange.mockReset();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/meta/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/metrics/tags/potato/',
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/metrics/tags/span.module/',
      body: [],
    });
  });

  describe('using SearchQueryBuilder', function () {
    it('does not allow illegal filters', async function () {
      render(
        <MetricSearchBar onChange={onChange} mri="d:transactions/duration@millisecond" />
      );
      await screen.findByPlaceholderText('Filter by tags');
      await userEvent.type(screen.getByPlaceholderText('Filter by tags'), 'potato:db');
      await userEvent.keyboard('{enter}');
      screen.getByText('Invalid key. "potato" is not a supported search key.');
      expect(onChange).not.toHaveBeenCalled();
    });
    it('does not allow insights filters when not using an insights mri', async function () {
      render(
        <MetricSearchBar onChange={onChange} mri="d:transactions/duration@millisecond" />
      );
      await screen.findByPlaceholderText('Filter by tags');
      await userEvent.type(
        screen.getByPlaceholderText('Filter by tags'),
        'span.module:db'
      );
      await userEvent.keyboard('{enter}');
      screen.getByText('Invalid key. "span.module" is not a supported search key.');
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
