import {Event as MockEvent} from 'sentry-fixture/event';
import {Group as GroupFixture} from 'sentry-fixture/group';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import RegressionMessage from 'sentry/components/events/eventStatisticalDetector/regressionMessage';
import {IssueType} from 'sentry/types';
import {DAY} from 'sentry/utils/formatters';

const DURATION_REGRESSION_TYPE = 1017;

describe('Regression message', () => {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [],
      },
    });
  });

  it('does not show a Go to Summary button if the breakpoint is under 14 days old', () => {
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

    const mockGroup = GroupFixture({
      issueType: IssueType.PERFORMANCE_DURATION_REGRESSION,
    });

    render(<RegressionMessage event={mockEvent} group={mockGroup} />);

    expect(screen.queryByText('Go to Summary')).not.toBeInTheDocument();
  });

  it('shows a Go to Summary button if the breakpoint is over 14 days old', async () => {
    const mockEvent = MockEvent({
      occurrence: {
        evidenceData: {
          breakpoint: (Date.now() - 20 * DAY) / 1000,
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

    const mockGroup = GroupFixture({
      issueType: IssueType.PERFORMANCE_DURATION_REGRESSION,
    });

    render(<RegressionMessage event={mockEvent} group={mockGroup} />);

    expect(await screen.findByText('Go to Summary')).toBeInTheDocument();
  });
});
