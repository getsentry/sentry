import type {ComponentProps} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {AttributeComparisonSection} from 'sentry/views/issueDetails/streamline/sidebar/attributeComparisonSection';

describe('AttributeComparisonSection', () => {
  const organization = OrganizationFixture();
  const openPeriodStart = '2024-01-01T00:00:00Z';
  const openPeriodEnd = '2024-01-01T00:10:00Z';

  const defaultProps: ComponentProps<typeof AttributeComparisonSection> = {
    openPeriodStart,
    openPeriodEnd,
    isOpenPeriodLoading: false,
    projectId: 1,
    snubaQuery: {
      aggregate: 'count()',
      dataset: Dataset.ERRORS,
      eventTypes: [EventTypes.ERROR],
      id: '1',
      query: 'is:unresolved event.type:error',
      timeWindow: 60,
    },
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a View All link and requests ranked attributes', async () => {
    const rankedAttributesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/ranked/`,
      method: 'GET',
      body: {
        cohort1Total: 0,
        cohort2Total: 0,
        rankedAttributes: [],
      },
    });

    render(<AttributeComparisonSection {...defaultProps} />, {organization});

    await waitFor(() => {
      expect(rankedAttributesRequest).toHaveBeenCalled();
    });

    const [requestUrl, requestOptions] = rankedAttributesRequest.mock.calls[0]!;
    expect(requestUrl).toBe(
      `/organizations/${organization.slug}/trace-items/attributes/ranked/`
    );
    expect(requestOptions).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          project: [1],
          start: '2023-12-25T00:00:00.000',
          end: '2024-01-01T00:10:00.000',
          dataset: 'spans',
          function: defaultProps.snubaQuery.aggregate,
          above: 1,
          sampling: 'NORMAL',
          aggregateExtrapolation: '1',
          query_1: expect.stringContaining('timestamp:>=2024-01-01T00:00:00'),
          query_2: 'is:unresolved event.type:error',
        }),
      })
    );

    const viewAllLink = screen.getByRole('button', {name: 'View All'});
    const href = viewAllLink.getAttribute('href');
    expect(href).toBeTruthy();

    const parsedUrl = new URL(href!, 'http://localhost');
    expect(parsedUrl.pathname).toBe(
      `/organizations/${organization.slug}/explore/traces/`
    );
    expect(parsedUrl.searchParams.get('table')).toBe('attribute_breakdowns');
    expect(parsedUrl.searchParams.get('mode')).toBe('samples');
    expect(parsedUrl.searchParams.get('project')).toBe('1');
    expect(parsedUrl.searchParams.get('query')).toBe(defaultProps.snubaQuery.query);
    expect(parsedUrl.searchParams.get('start')).toBe('2023-12-25T00:00:00.000');
    expect(parsedUrl.searchParams.get('end')).toBe('2024-01-01T00:10:00.000');

    const chartSelection = JSON.parse(parsedUrl.searchParams.get('chartSelection')!);
    expect(chartSelection).toEqual({
      chartIndex: 0,
      range: [new Date(openPeriodStart).getTime(), new Date(openPeriodEnd).getTime()],
      panelId: 'grid--\u0000series\u00000\u00000',
    });
  });
});
