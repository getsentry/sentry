import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbWebVital} from 'sentry/components/replays/breadcrumbs/breadcrumbWebVital';
import {hydrateSpans} from 'sentry/utils/replays/hydrateSpans';
import type {RawSpanFrame} from 'sentry/utils/replays/types';

function makeCLSFrame(data: Record<string, unknown> | undefined) {
  const [frame] = hydrateSpans(ReplayRecordFixture(), [
    {
      op: 'web-vital',
      description: 'cumulative-layout-shift',
      startTimestamp: new Date('2024/06/21').getTime() / 1000,
      endTimestamp: new Date('2024/06/21').getTime() / 1000,
      data,
    } as RawSpanFrame,
  ]);
  return frame!;
}

function renderWebVital(frame: ReturnType<typeof makeCLSFrame>) {
  return render(
    <BreadcrumbWebVital
      frame={frame}
      expandPaths={['$', '$.Layout shifts', '$.Layout shifts.0', '$.Layout shifts.1']}
      onInspectorExpanded={() => {}}
      onMouseEnter={() => {}}
      onMouseLeave={() => {}}
    />
  );
}

describe('BreadcrumbWebVital', () => {
  it('renders a CLS layout shift row when attributions are missing', () => {
    renderWebVital(makeCLSFrame({value: 0.25, size: 0.25, rating: 'poor'}));

    expect(screen.getByText('Layout shifts')).toBeInTheDocument();
    expect(screen.getByText('score 0.25')).toBeInTheDocument();
  });

  it('renders a CLS layout shift row when data is missing', () => {
    renderWebVital(makeCLSFrame(undefined));

    expect(screen.getByText('Layout shifts')).toBeInTheDocument();
    expect(screen.getByText('score unknown')).toBeInTheDocument();
  });

  it('renders a CLS layout shift row per attribution without selectors', () => {
    renderWebVital(
      makeCLSFrame({
        value: 0.3,
        size: 0.3,
        rating: 'poor',
        attributions: [
          {value: 0.1, nodeIds: [1]},
          {value: 0.2, nodeIds: [2]},
        ],
      })
    );

    expect(screen.getByText('score 0.1')).toBeInTheDocument();
    expect(screen.getByText('score 0.2')).toBeInTheDocument();
  });
});
