import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {GroupOpenPeriodFixture} from 'sentry-fixture/groupOpenPeriod';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {MetricDetectorRecentIssues} from 'sentry/views/detectors/components/details/metric/recentIssues';

describe('MetricDetectorRecentIssues', () => {
  const detector = MetricDetectorFixture({id: '1', projectId: '2'});

  const flappyIssueOpenPeriods = [
    GroupOpenPeriodFixture({
      id: '30',
      groupId: '200',
      shortId: 'PROJ-2',
      start: '2017-10-16T12:00:00Z',
      end: null,
      isOpen: true,
    }),
    GroupOpenPeriodFixture({
      id: '20',
      groupId: '200',
      shortId: 'PROJ-2',
      start: '2017-10-16T10:00:00Z',
      end: '2017-10-16T10:30:00Z',
      isOpen: false,
    }),
  ];

  const olderIssueOpenPeriod = GroupOpenPeriodFixture({
    id: '10',
    groupId: '100',
    shortId: 'PROJ-1',
    start: '2017-10-15T08:00:00Z',
    end: '2017-10-15T09:00:00Z',
    isOpen: false,
  });

  const resolvedIssueOpenPeriods = [
    GroupOpenPeriodFixture({
      id: '50',
      groupId: '300',
      shortId: 'PROJ-3',
      start: '2017-10-10T12:00:00Z',
      end: '2017-10-10T12:20:00Z',
      isOpen: false,
    }),
    GroupOpenPeriodFixture({
      id: '40',
      groupId: '300',
      shortId: 'PROJ-3',
      start: '2017-10-10T10:00:00Z',
      end: '2017-10-10T10:30:00Z',
      isOpen: false,
    }),
  ];

  it('lists each issue once with how many open periods it had', async () => {
    const openPeriodsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [...flappyIssueOpenPeriods, olderIssueOpenPeriod],
    });

    render(<MetricDetectorRecentIssues detector={detector} />);

    expect(await screen.findByRole('link', {name: 'PROJ-2'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/200/'
    );

    expect(screen.getAllByRole('link', {name: 'PROJ-2'})).toHaveLength(1);

    expect(screen.getByRole('link', {name: 'PROJ-1'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/100/'
    );

    const flappyIssueRow = screen.getByRole('row', {name: /PROJ-2/});

    expect(within(flappyIssueRow).getByText('Ongoing')).toBeInTheDocument();

    expect(within(flappyIssueRow).getByText('2')).toBeInTheDocument();

    const olderIssueRow = screen.getByRole('row', {name: /PROJ-1/});

    expect(within(olderIssueRow).getByText('Resolved')).toBeInTheDocument();

    expect(within(olderIssueRow).getByText('1')).toBeInTheDocument();

    expect(openPeriodsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/open-periods/',
      expect.objectContaining({
        query: expect.objectContaining({detectorId: '1', per_page: 100}),
      })
    );
  });

  it('expands an issue to list each of its open periods', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [...flappyIssueOpenPeriods, olderIssueOpenPeriod],
    });

    render(<MetricDetectorRecentIssues detector={detector} />);

    const flappyIssueRow = within(await screen.findByRole('row', {name: /PROJ-2/}));

    expect(screen.getAllByRole('row')).toHaveLength(3);

    await userEvent.click(
      flappyIssueRow.getByRole('button', {name: 'Show open periods'})
    );

    expect(
      flappyIssueRow.getByRole('button', {name: 'Hide open periods'})
    ).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getAllByRole('row')).toHaveLength(5);
  });

  it('shows how long an issue was open in total and each open period in line with the columns', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: resolvedIssueOpenPeriods,
    });

    render(<MetricDetectorRecentIssues detector={detector} />);

    const issueRow = within(await screen.findByRole('row', {name: /PROJ-3/}));

    expect(issueRow.getByText('50min')).toBeInTheDocument();

    await userEvent.click(issueRow.getByRole('button', {name: 'Show open periods'}));

    const [latestOpenPeriodRow, earliestOpenPeriodRow] = screen.getAllByRole('row', {
      name: /^Opened/,
    });

    expect(within(latestOpenPeriodRow!).getByText('20min')).toBeInTheDocument();

    expect(within(earliestOpenPeriodRow!).getByText('30min')).toBeInTheDocument();

    const columnCount = screen.getAllByRole('columnheader').length;

    expect(within(latestOpenPeriodRow!).getAllByRole('cell')).toHaveLength(columnCount);
  });

  it('zooms an issue to the span of all of its open periods', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: resolvedIssueOpenPeriods,
    });

    const {router} = render(<MetricDetectorRecentIssues detector={detector} />);

    const issueRow = within(await screen.findByRole('row', {name: /PROJ-3/}));

    await userEvent.click(issueRow.getByRole('button', {name: 'Zoom'}));

    expect(router.location.query).toEqual(
      expect.objectContaining({
        start: '2017-10-10T09:50:00',
        end: '2017-10-10T12:30:00',
      })
    );
  });

  it('links View All to every issue from the detector, most recently seen first', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });

    render(<MetricDetectorRecentIssues detector={detector} />);

    const viewAllHref = (
      await screen.findByRole('button', {name: 'View All'})
    ).getAttribute('href');

    const viewAllQuery = new URL(viewAllHref ?? '', 'https://example.com').searchParams;

    expect(viewAllQuery.get('query')).toBe('detector:1');

    expect(viewAllQuery.get('project')).toBe('2');

    expect(viewAllQuery.get('sort')).toBe('date');
  });

  it('explains when the monitor opens a new issue', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });

    render(<MetricDetectorRecentIssues detector={detector} />);

    await userEvent.hover(screen.getByRole('img', {name: 'More information'}));

    expect(
      await screen.findByText(
        'Sentry will open a new issue if your monitor has not breached in the past 24 hours'
      )
    ).toBeInTheDocument();
  });

  it('shows an empty state when the detector has no issues in range', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });

    render(<MetricDetectorRecentIssues detector={detector} />);

    expect(
      await screen.findByText('No issues for this monitor within the current date range')
    ).toBeInTheDocument();
  });
});
