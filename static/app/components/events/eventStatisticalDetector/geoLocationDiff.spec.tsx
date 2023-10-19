import {Event as EventMock} from 'sentry-fixture/event';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {Event} from 'sentry/types';
import {DAY} from 'sentry/utils/formatters';

import GeoLocationDiff from './geoLocationDiff';

describe('GeoLocationDiff', () => {
  const DURATION_REGRESSION_TYPE = 1017;
  const PROJECT_ID = '1';

  // Breakpoint is stored as seconds
  const BREAKPOINT_TIMESTAMP = (Date.now() - 7 * DAY) / 1000;
  let mockEvent: Event;

  beforeEach(() => {
    mockEvent = {
      ...EventMock(),
      occurrence: {
        evidenceData: {
          breakpoint: BREAKPOINT_TIMESTAMP,
          transaction: '/api/0/transaction-test-endpoint/',
        },
        evidenceDisplay: [
          {
            name: 'Transaction',
            value: '/api/0/transaction-test-endpoint/',
            important: false,
          },
        ],
        fingerprint: [],
        id: '',
        issueTitle: '',
        resourceId: '',
        subtitle: '',
        detectionTime: '',
        eventId: '',
        type: DURATION_REGRESSION_TYPE,
      },
    };
  });

  it('renders a row for each result with country code, name, and percent increase in duration', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-root-cause-analysis/',
      method: 'GET',
      body: [
        {
          duration_after: 10,
          duration_before: 5,
          duration_delta: 5,
          ['geo.country_code']: 'US',
        },
        {
          duration_after: 7,
          duration_before: 5,
          duration_delta: 2,
          ['geo.country_code']: 'CA',
        },
      ],
    });

    render(<GeoLocationDiff projectId={PROJECT_ID} event={mockEvent} />);

    expect(
      await screen.findByText(
        'An increase in the transaction duration has been detected for the following countries. The results are sorted by their overall effect on the duration, based off of the change in duration and the current TPM.'
      )
    ).toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    within(rows[0]).getByText('US');
    within(rows[0]).getByText('United States');
    within(rows[0]).getByText('+100.00%');

    within(rows[1]).getByText('CA');
    within(rows[1]).getByText('Canada');
    within(rows[1]).getByText('+40.00%');
  });

  it('shows the absolute durations in a tooltip when the percent increases are hovered', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-root-cause-analysis/',
      method: 'GET',
      body: [
        {
          duration_after: 10,
          duration_before: 5,
          duration_delta: 5,
          ['geo.country_code']: 'US',
        },
      ],
    });

    render(<GeoLocationDiff projectId={PROJECT_ID} event={mockEvent} />);

    await userEvent.hover(await screen.findByText('+100.00%'));

    const tooltip = await screen.findByTestId('geo-duration-change-tooltip-content');
    expect(tooltip).toHaveTextContent('From 5.00ms to 10.00ms');
  });

  it('requests 7 days of data around the event breakpoint', () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-root-cause-analysis/',
      method: 'GET',
      body: [
        {
          duration_after: 10,
          duration_before: 5,
          duration_delta: 5,
          ['geo.country_code']: 'US',
        },
      ],
    });

    render(<GeoLocationDiff projectId={PROJECT_ID} event={mockEvent} />);

    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/events-root-cause-analysis/',
      expect.objectContaining({
        query: expect.objectContaining({
          start: new Date(BREAKPOINT_TIMESTAMP * 1000 - 7 * DAY).toISOString(),
          end: new Date(BREAKPOINT_TIMESTAMP * 1000 + 7 * DAY).toISOString(),
        }),
      })
    );
  });

  it('links to the transaction summary page with the geo code as a filter', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-root-cause-analysis/',
      method: 'GET',
      body: [
        {
          duration_after: 10,
          duration_before: 5,
          duration_delta: 5,
          ['geo.country_code']: 'US',
        },
      ],
    });

    render(<GeoLocationDiff projectId={PROJECT_ID} event={mockEvent} />);

    const url = new URL(
      (await screen.findByText('+100.00%')).getAttribute('href') as string,
      'http://mockHost.com'
    );
    expect(url.pathname).toBe('/organizations/org-slug/performance/summary/');
    expect(url.searchParams.get('query')).toBe('geo.country_code:US');
    expect(url.searchParams.get('display')).toBe('duration');
    expect(new Set(url.searchParams.getAll('unselectedSeries'))).toEqual(
      new Set(['avg()', 'p99()', 'p100()', 'p50()', 'p75()'])
    );
  });
});
