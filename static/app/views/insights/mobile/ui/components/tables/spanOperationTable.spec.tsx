import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanOperationTable} from 'sentry/views/insights/mobile/ui/components/tables/spanOperationTable';
import {Referrer} from 'sentry/views/insights/mobile/ui/referrers';

jest.mock('sentry/utils/usePageFilters');

jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());

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
            'division_if(mobile.slow_frames,mobile.total_frames,release,equals,foo)',
            'division_if(mobile.slow_frames,mobile.total_frames,release,equals,bar)',
            'division_if(mobile.frozen_frames,mobile.total_frames,release,equals,foo)',
            'division_if(mobile.frozen_frames,mobile.total_frames,release,equals,bar)',
            'avg_if(mobile.frames_delay,release,equals,foo)',
            'avg_if(mobile.frames_delay,release,equals,bar)',
            'avg_compare(mobile.frames_delay,release,foo,bar)',
          ],
        }),
      })
    );
  });
});
