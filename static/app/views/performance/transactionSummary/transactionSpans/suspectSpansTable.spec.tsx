import {
  initializeData as _initializeData,
  makeSuspectSpan,
  SAMPLE_SPANS,
} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import SuspectSpansTable from 'sentry/views/performance/transactionSummary/transactionSpans/suspectSpansTable';
import {SpanSortOthers} from 'sentry/views/performance/transactionSummary/transactionSpans/types';

const initializeData = () => {
  const data = _initializeData({
    features: ['performance-view'],
  });

  act(() => ProjectsStore.loadInitialData(data.projects));
  return data;
};

describe('SuspectSpansTable', () => {
  it('should not calculate frequency percentages above 100%', async () => {
    const initialData = initializeData();
    const suspectSpan = makeSuspectSpan(SAMPLE_SPANS[0]!);
    suspectSpan.frequency = 120;

    render(
      <SuspectSpansTable
        location={initialData.router.location}
        organization={initialData.organization}
        transactionName="Test Transaction"
        isLoading={false}
        suspectSpans={[suspectSpan]}
        totals={{'count()': 100}}
        sort={SpanSortOthers.SUM_EXCLUSIVE_TIME}
      />,
      {router: initialData.router}
    );

    const frequencyHeader = await screen.findByTestId('grid-editable');
    expect(await within(frequencyHeader).findByText('100%')).toBeInTheDocument();
  });
});
