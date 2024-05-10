import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {Referrer} from 'sentry/views/performance/mobile/ui/referrers';
import {SpanOperationTable} from 'sentry/views/performance/mobile/ui/screenSummary/spanOperationTable';

jest.mock('sentry/utils/usePageFilters');

jest.mocked(usePageFilters).mockReturnValue({
  isReady: true,
  desyncedFilters: new Set(),
  pinnedFilters: new Set(),
  shouldPersist: true,
  selection: {
    datetime: {
      period: '10d',
      start: null,
      end: null,
      utc: false,
    },
    environments: [],
    projects: [],
  },
});

describe('SpanOperationTable', () => {
  it('renders and fetches the proper data', () => {
    const spanOpTableRequestMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
      match: [MockApiClient.matchQuery({referrer: Referrer.SPAN_OPERATION_TABLE})],
    });

    render(
      <SpanOperationTable
        transaction="transaction"
        primaryRelease="foo"
        secondaryRelease="bar"
      />
    );

    [
      'Operation',
      'Span Description',
      'Slow (R1)',
      'Slow (R2)',
      'Frozen (R1)',
      'Frozen (R2)',
      'Delay (R1)',
      'Delay (R2)',
    ].forEach(header => {
      expect(screen.getByRole('columnheader', {name: header})).toBeInTheDocument();
    });

    expect(screen.getAllByRole('columnheader', {name: 'Change'})).toHaveLength(3);

    expect(spanOpTableRequestMock).toHaveBeenCalledTimes(1);

    expect(spanOpTableRequestMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: [
            'project.id',
            'span.op',
            'span.group',
            'span.description',
            'avg_if(mobile.slow_frames,release,foo)',
            'avg_if(mobile.slow_frames,release,bar)',
            'avg_compare(mobile.slow_frames,release,foo,bar)',
            'avg_if(mobile.frozen_frames,release,foo)',
            'avg_if(mobile.frozen_frames,release,bar)',
            'avg_compare(mobile.frozen_frames,release,foo,bar)',
            'avg_if(mobile.frames_delay,release,foo)',
            'avg_if(mobile.frames_delay,release,bar)',
            'avg_compare(mobile.frames_delay,release,foo,bar)',
          ],
        }),
      })
    );
  });
});
