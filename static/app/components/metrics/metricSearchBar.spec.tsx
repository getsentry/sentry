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
      method: 'POST',
      url: '/organizations/org-slug/recent-searches/',
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

  describe('using SmartSearchBar', function () {
    it('does not allow illegal filters', async function () {
      render(
        <MetricSearchBar onChange={onChange} mri="d:transactions/duration@millisecond" />
      );
      await screen.findByPlaceholderText('Filter by tags');
      await userEvent.type(screen.getByPlaceholderText('Filter by tags'), 'potato:db');
      expect(screen.getByTestId('search-autocomplete-item')).toHaveTextContent(
        "The field potato isn't supported here."
      );
      await userEvent.keyboard('{enter}');
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
      expect(screen.getByTestId('search-autocomplete-item')).toHaveTextContent(
        "The field span.module isn't supported here."
      );
      await userEvent.keyboard('{enter}');
      expect(onChange).not.toHaveBeenCalled();
    });
    it('allows insights specific filters when using an insights mri', async function () {
      render(
        <MetricSearchBar onChange={onChange} mri="d:spans/exclusive_time@millisecond" />
      );
      await screen.findByPlaceholderText('Filter by tags');
      await userEvent.type(
        screen.getByPlaceholderText('Filter by tags'),
        'span.module:db'
      );
      expect(screen.queryByTestId('search-autocomplete-item')).not.toBeInTheDocument();
      await userEvent.keyboard('{enter}');
      expect(onChange).toHaveBeenCalledWith('span.module:"db"');
    });
  });

  describe('using SearchQueryBuilder', function () {
    const organization = {features: ['search-query-builder-metrics']};
    it('does not allow illegal filters', async function () {
      render(
        <MetricSearchBar onChange={onChange} mri="d:transactions/duration@millisecond" />,
        {
          organization,
        }
      );
      await screen.findByPlaceholderText('Filter by tags');
      await userEvent.type(screen.getByPlaceholderText('Filter by tags'), 'potato:db');
      await userEvent.keyboard('{enter}');
      screen.getByText('Invalid key. "potato" is not a supported search key.');
      expect(onChange).not.toHaveBeenCalled();
    });
    it('does not allow insights filters when not using an insights mri', async function () {
      render(
        <MetricSearchBar onChange={onChange} mri="d:transactions/duration@millisecond" />,
        {
          organization,
        }
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
    it('allows insights specific filters when using an insights mri', async function () {
      render(
        <MetricSearchBar onChange={onChange} mri="d:spans/exclusive_time@millisecond" />,
        {
          organization,
        }
      );
      await screen.findByPlaceholderText('Filter by tags');
      await userEvent.type(
        screen.getByPlaceholderText('Filter by tags'),
        'span.module:db'
      );
      await userEvent.keyboard('{enter}');
      expect(
        screen.queryByText('Invalid key. "span.module" is not a supported search key.')
      ).not.toBeInTheDocument();
      expect(onChange).toHaveBeenCalledWith('span.module:"db"');
    });
  });
});
