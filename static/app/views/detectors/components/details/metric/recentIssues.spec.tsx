import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {GroupOpenPeriodFixture} from 'sentry-fixture/groupOpenPeriod';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MetricDetectorRecentIssues} from 'sentry/views/detectors/components/details/metric/recentIssues';

describe('MetricDetectorRecentIssues', () => {
  const detector = MetricDetectorFixture({id: '1', projectId: '2'});

  it('lists one row per recent firing linked to its issue', async () => {
    const openPeriodsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [
        GroupOpenPeriodFixture({
          id: '20',
          groupId: '200',
          shortId: 'PROJ-2',
          start: '2025-06-01T12:00:00Z',
          end: null,
          isOpen: true,
        }),
        GroupOpenPeriodFixture({
          id: '10',
          groupId: '100',
          shortId: 'PROJ-1',
          start: '2025-06-01T10:00:00Z',
          end: '2025-06-01T11:00:00Z',
          isOpen: false,
        }),
      ],
    });

    render(<MetricDetectorRecentIssues detector={detector} />);

    expect(await screen.findByRole('link', {name: 'PROJ-2'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/200/'
    );

    expect(screen.getByRole('link', {name: 'PROJ-1'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/100/'
    );

    expect(screen.getByText('Ongoing')).toBeInTheDocument();

    expect(screen.getByText('Resolved')).toBeInTheDocument();

    expect(screen.getAllByRole('button', {name: 'Zoom'})).toHaveLength(2);

    expect(openPeriodsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/open-periods/',
      expect.objectContaining({
        query: expect.objectContaining({detectorId: '1', per_page: 5}),
      })
    );
  });

  it('links View All to every issue from the detector, resolved included', async () => {
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
  });

  it('shows an empty state when the detector has no firings in range', async () => {
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
