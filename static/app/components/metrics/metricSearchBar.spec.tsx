import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MetricSearchBar} from 'sentry/components/metrics/metricSearchBar';

describe('metricSearchBar', function () {
  beforeEach(() => {
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
  });
  it('does not allow illegal filters', async function () {
    render(<MetricSearchBar onChange={() => undefined} />);
    await screen.findByPlaceholderText('Filter by tags');
    await userEvent.type(screen.getByPlaceholderText('Filter by tags'), 'potato:db');
    expect(screen.getByTestId('search-autocomplete-item')).toHaveTextContent(
      "The field potato isn't supported here."
    );
  });
  it('does not allow insights filters when not using an insights mri', async function () {
    render(<MetricSearchBar onChange={() => undefined} />);
    await screen.findByPlaceholderText('Filter by tags');
    await userEvent.type(screen.getByPlaceholderText('Filter by tags'), 'span.module:db');
    expect(screen.getByTestId('search-autocomplete-item')).toHaveTextContent(
      "The field span.module isn't supported here."
    );
  });
  it('allows insights specific filters when using an insights mri', async function () {
    const onChange = jest.fn();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/tags/span.module/',
      body: [],
    });
    render(
      <MetricSearchBar onChange={onChange} mri="d:spans/exclusive_time@millisecond" />
    );
    await screen.findByPlaceholderText('Filter by tags');
    await userEvent.type(screen.getByPlaceholderText('Filter by tags'), 'span.module:db');
    await userEvent.keyboard('{enter}');
    expect(onChange).toHaveBeenCalledWith('span.module:"db"');
  });
});
