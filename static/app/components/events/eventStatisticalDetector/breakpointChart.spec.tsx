import {Event as MockEvent} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventBreakpointChart from 'sentry/components/events/eventStatisticalDetector/breakpointChart';
import {DAY} from 'sentry/utils/formatters';

const DURATION_REGRESSION_TYPE = 1017;

describe('Regression breakpoint chart', () => {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [],
      },
    });
  });

  it('does not show a Go to Transaction Summary button if the breakpoint is under 14 days old', () => {
    const mockEvent = MockEvent({
      occurrence: {
        evidenceData: {
          breakpoint: (Date.now() - DAY) / 1000,
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
    });

    render(<EventBreakpointChart event={mockEvent} />);

    expect(screen.queryByText('Go to Transaction Summary')).not.toBeInTheDocument();
  });

  it('shows a Go to Transaction Summary button if the breakpoint is over 14 days old', async () => {
    const mockEvent = MockEvent({
      occurrence: {
        evidenceData: {
          breakpoint: (Date.now() - 15 * DAY) / 1000,
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
    });

    render(<EventBreakpointChart event={mockEvent} />);

    expect(await screen.findByText('Go to Transaction Summary')).toBeInTheDocument();
  });
});
