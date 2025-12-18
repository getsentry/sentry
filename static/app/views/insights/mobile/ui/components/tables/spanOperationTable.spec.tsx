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

    render(<SpanOperationTable transaction="transaction" primaryRelease="foo" />);

    ['Operation', 'Span Description', 'Slow', 'Frozen', 'Delay'].forEach(header => {
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
            'division(mobile.slow_frames,mobile.total_frames)',
            'division(mobile.frozen_frames,mobile.total_frames)',
            'avg(mobile.frames_delay)',
          ],
        }),
      })
    );
  });
});
