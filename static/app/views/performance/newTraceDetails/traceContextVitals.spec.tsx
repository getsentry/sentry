import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {TraceContextVitals} from './traceContextVitals';

const organization = OrganizationFixture();

const rootEventResults = {
  data: {
    attributes: [{name: 'measurements.frames_slow_rate', type: 'float', value: 0.02}],
  },
} as unknown as TraceRootEventQueryResults;

describe('TraceContextVitals', () => {
  it('merges tree.vitals with root event attributes for mobile vitals', () => {
    const tree = TraceTree.FromTrace(
      makeEAPTrace([
        makeEAPSpan({
          event_id: 'ui-load-root',
          op: 'ui.load',
          is_transaction: true,
          parent_span_id: null,
          children: [
            makeEAPSpan({
              event_id: 'app-start',
              op: 'app.start',
              is_transaction: true,
              mobile_app_vital: {
                'app.vitals.start.cold.value': 1600,
                'app.vitals.start.warm.value': 400,
              },
            }),
          ],
        }),
      ]),
      {replay: null, meta: null, organization}
    );

    render(
      <TraceContextVitals
        tree={tree}
        rootEventResults={rootEventResults}
        containerWidth={2000}
      />,
      {organization}
    );

    expect(screen.getByText('App Start Cold')).toBeInTheDocument();
    expect(screen.getByText('1.60s')).toBeInTheDocument();
    expect(screen.getByText('App Start Warm')).toBeInTheDocument();
    expect(screen.getByText('400.00ms')).toBeInTheDocument();

    expect(screen.getByText('Slow Frames Rate')).toBeInTheDocument();
    expect(screen.getByText('0.02')).toBeInTheDocument();
  });
});
