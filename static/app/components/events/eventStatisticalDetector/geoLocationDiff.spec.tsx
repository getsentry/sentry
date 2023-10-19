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

    const firstRow = (await screen.findByText('US')).parentElement as HTMLElement;
    expect(firstRow).toBeInTheDocument();
    within(firstRow).getByText('United States');
    within(firstRow).getByText('+100.00%');

    const secondRow = (await screen.findByText('CA')).parentElement as HTMLElement;
    expect(secondRow).toBeInTheDocument();
    within(secondRow).getByText('Canada');
    within(secondRow).getByText('+40.00%');
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
});
