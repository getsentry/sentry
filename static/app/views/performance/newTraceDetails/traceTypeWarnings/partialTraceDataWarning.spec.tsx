import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {PartialTraceDataWarning} from './partialTraceDataWarning';

describe('PartialTraceDataWarning', () => {
  describe('when the trace is older than 30 days', () => {
    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(new Date(2025, 0, 31));
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('should render warning', () => {
      const organization = OrganizationFixture();
      const start = new Date('2024-01-01T00:00:00Z').getTime() / 1e3;

      const eapTrace = makeEAPTrace([
        makeEAPSpan({
          op: 'http.server',
          start_timestamp: start,
          end_timestamp: start + 2,
          children: [makeEAPSpan({start_timestamp: start + 1, end_timestamp: start + 4})],
        }),
      ]);

      render(
        <PartialTraceDataWarning
          logs={[]}
          timestamp={start}
          tree={TraceTree.FromTrace(eapTrace, {replay: null, meta: null, organization})}
        />,
        {organization}
      );

      expect(screen.getByText('Partial Trace Data:')).toBeInTheDocument();

      expect(
        screen.getByText(
          'Trace may be missing spans since the age of the trace is older than 30 days'
        )
      ).toBeInTheDocument();

      expect(
        screen.getByRole('link', {name: 'Search similar traces in the past 24 hours'})
      ).toBeInTheDocument();

      const queryString = encodeURIComponent('is_transaction:true span.op:http.server');
      expect(
        screen.getByRole('link', {name: 'Search similar traces in the past 24 hours'})
      ).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/explore/traces/?mode=samples&project=1&query=${queryString}&statsPeriod=24h&table=trace`
      );
    });
  });

  describe('when the trace is younger than 30 days', () => {
    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(new Date(2025, 0, 1));
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('should not render the warning', () => {
      const organization = OrganizationFixture();
      const start = new Date('2025-01-01T00:00:00Z').getTime() / 1e3;

      const eapTrace = makeEAPTrace([
        makeEAPSpan({
          op: 'http.server',
          start_timestamp: start,
          end_timestamp: start + 2,
          children: [makeEAPSpan({start_timestamp: start + 1, end_timestamp: start + 4})],
        }),
      ]);

      render(
        <PartialTraceDataWarning
          logs={[]}
          timestamp={start}
          tree={TraceTree.FromTrace(eapTrace, {replay: null, meta: null, organization})}
        />,
        {organization}
      );

      expect(screen.queryByText('Partial Trace Data:')).not.toBeInTheDocument();

      expect(
        screen.queryByText(
          'Trace may be missing spans since the age of the trace is older than 30 days'
        )
      ).not.toBeInTheDocument();

      expect(
        screen.queryByRole('link', {name: 'Search similar traces in the past 24 hours'})
      ).not.toBeInTheDocument();
    });
  });
});
