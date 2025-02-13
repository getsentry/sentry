import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {
  GroupActivityType,
  GroupStatus,
  IssueCategory,
  IssueType,
} from 'sentry/types/group';
import {OccurrenceSummary} from 'sentry/views/issueDetails/streamline/occurrenceSummary';

describe('OccurrenceSummary', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  afterEach(() => {
    resetMockDate();
  });

  it('renders empty if not enabled in the issue config', function () {
    const group = GroupFixture();
    const event = EventFixture();
    const {container} = render(<OccurrenceSummary group={group} event={event} />, {
      organization,
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders downtime if enabled', function () {
    const group = GroupFixture({
      issueCategory: IssueCategory.UPTIME,
      issueType: IssueType.UPTIME_DOMAIN_FAILURE,
      status: GroupStatus.RESOLVED,
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED,
          dateCreated: '2025-01-02T11:00:00Z',
          data: {},
          project,
          id: '2',
        },
        {
          type: GroupActivityType.FIRST_SEEN,
          dateCreated: '2025-01-01T11:00:00Z',
          data: {},
          project,
          id: '1',
        },
      ],
    });
    const event = EventFixture();
    render(<OccurrenceSummary group={group} event={event} />, {
      organization,
    });
    expect(screen.getByText('Downtime')).toBeInTheDocument();
    expect(screen.getByText('1 day')).toBeInTheDocument();
  });

  it('renders detector details if found', function () {
    const group = GroupFixture({
      issueCategory: IssueCategory.UPTIME,
      issueType: IssueType.UPTIME_DOMAIN_FAILURE,
    });
    const event = EventFixture({
      tags: [
        {
          key: 'uptime_rule',
          value: '123',
        },
      ],
    });
    render(<OccurrenceSummary group={group} event={event} />, {
      organization,
    });
    expect(screen.getByText('Monitor ID')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('renders evidence detailsif found', function () {
    const now = '2025-01-01T12:00:00Z';
    setMockDate(new Date(now));

    const group = GroupFixture({
      issueCategory: IssueCategory.CRON,
      issueType: IssueType.MONITOR_CHECK_IN_FAILURE,
    });
    const event = EventFixture({
      occurrence: {
        evidenceDisplay: [
          {
            name: 'Environment',
            value: 'production',
          },
          {
            name: 'Status Code',
            value: '500',
          },
          {
            name: 'Failure reason',
            value: 'bad things',
          },
          {
            name: 'Last successful check-in',
            value: '2025-01-01T11:00:00Z',
          },
        ],
      },
    });
    render(<OccurrenceSummary group={group} event={event} />, {
      organization,
    });
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();

    expect(screen.getByText('Status Code')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();

    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText('bad things')).toBeInTheDocument();

    expect(screen.getByText('Last Successful Check-In')).toBeInTheDocument();
    expect(screen.getByText('an hour ago')).toBeInTheDocument();
  });
});
