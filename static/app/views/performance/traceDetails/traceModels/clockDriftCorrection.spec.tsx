import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  isEAPSpanNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
} from 'sentry/views/performance/traceDetails/traceGuards';

import type {BaseNode} from './traceTreeNode/baseNode';
import {
  applyClockDriftCorrection,
  collectClockDriftCorrections,
  getAlignmentRange,
  getClockDriftShifts,
  getSmallestShift,
  MIN_CLOCK_DRIFT_CORRECTION_MS,
  removeClockDriftCorrection,
} from './clockDriftCorrection';
import {TraceTree} from './traceTree';
import {makeEAPSpan, makeEAPTrace} from './traceTreeTestUtils';

const organization = OrganizationFixture();

const T = 1_700_000_000;
const ms = (value: number) => value / 1e3;

const preferences = {
  clock_drift_correction: true,
  missing_instrumentation: false,
  autogroup: {parent: false, sibling: false},
};

type Request = {
  /** Client span duration in ms. */
  clientDuration: number;
  /** Client span start in ms after the pageload started. */
  clientStart: number;
  id: string;
  /** Server span duration in ms. */
  serverDuration: number;
  /** Server span start in ms, relative to the client span start, as recorded. */
  serverStartGap: number;
  serverChildren?: Array<ReturnType<typeof makeEAPSpan>>;
  /** Whether the server span starts a new segment, i.e. runs in another process. */
  serverIsSegment?: boolean;
  serverProjectId?: number;
  serverSdkName?: string;
};

function makeRequest(request: Request) {
  const clientStart = T + ms(request.clientStart);
  const serverStart = clientStart + ms(request.serverStartGap);

  return makeEAPSpan({
    event_id: `client-${request.id}`,
    op: 'http.client',
    project_id: 1,
    project_slug: 'javascript',
    sdk_name: 'sentry.javascript.react',
    start_timestamp: clientStart,
    end_timestamp: clientStart + ms(request.clientDuration),
    children: [
      makeEAPSpan({
        event_id: `server-${request.id}`,
        op: 'http.server',
        is_transaction: request.serverIsSegment ?? true,
        project_id: request.serverProjectId ?? 2,
        project_slug: 'sentry',
        sdk_name: request.serverSdkName ?? 'sentry.python.django',
        parent_span_id: `client-${request.id}`,
        start_timestamp: serverStart,
        end_timestamp: serverStart + ms(request.serverDuration),
        children: request.serverChildren ?? [],
      }),
    ],
  });
}

function makePageload(requests: Array<ReturnType<typeof makeEAPSpan>>) {
  return makeEAPTrace([
    makeEAPSpan({
      event_id: 'pageload',
      op: 'pageload',
      is_transaction: true,
      project_id: 1,
      project_slug: 'javascript',
      sdk_name: 'sentry.javascript.react',
      start_timestamp: T - 10,
      end_timestamp: T + 300,
      children: requests,
    }),
  ]);
}

/** A server segment, e.g. one request handled on one host, making requests to other services. */
function makeSegment(id: string, requests: Array<ReturnType<typeof makeEAPSpan>>) {
  return makeEAPSpan({
    event_id: `segment-${id}`,
    op: 'http.server',
    is_transaction: true,
    project_id: 2,
    sdk_name: 'sentry.python.django',
    start_timestamp: T - 10,
    end_timestamp: T + 300,
    children: requests,
  });
}

function build(trace: ReturnType<typeof makeEAPTrace>, clockDriftCorrection = true) {
  return TraceTree.FromTrace(trace, {
    replay: null,
    organization,
    preferences: {...preferences, clock_drift_correction: clockDriftCorrection},
  });
}

function findSpan(tree: TraceTree, id: string): BaseNode {
  const node = tree.root.findChild(n => isEAPSpanNode(n) && n.value.event_id === id);
  if (!node) {
    throw new Error(`Span ${id} not found`);
  }
  return node;
}

/** Recorded server start relative to the (unshifted) client start, as currently displayed. */
function displayedGaps(tree: TraceTree, id: string) {
  const client = findSpan(tree, `client-${id}`);
  const server = findSpan(tree, `server-${id}`);
  return {
    start: server.space[0] - client.space[0],
    end: client.space[0] + client.space[1] - (server.space[0] + server.space[1]),
  };
}

describe('clock drift correction', () => {
  describe('getAlignmentRange', () => {
    it('returns the shifts that fit the server span into the client span', () => {
      expect(getAlignmentRange([1000, 500], [1100, 200])).toEqual([-100, 200]);
    });

    it('returns null if the server span is longer than the client span', () => {
      expect(getAlignmentRange([1000, 100], [1000, 200])).toBeNull();
    });
  });

  describe('getSmallestShift', () => {
    it.each([
      [[-100, 200], 0],
      [[50, 200], 50],
      [[-300, -20], -20],
    ] as Array<[[number, number], number]>)(
      'picks the shift closest to 0 in %j',
      (range, shift) => {
        expect(getSmallestShift(range)).toBe(shift);
      }
    );
  });

  describe('getClockDriftShifts', () => {
    it('uses one shift for all requests if one fits them all', () => {
      expect(
        getClockDriftShifts([
          [100, 300],
          [150, 400],
        ])
      ).toEqual([150, 150]);
    });

    it('leaves requests alone that disagree with the majority', () => {
      expect(
        getClockDriftShifts([
          [100, 200],
          [150, 250],
          [-400, -300],
        ])
      ).toEqual([150, 150, null]);
    });

    it('corrects nothing if there is no majority', () => {
      expect(
        getClockDriftShifts([
          [100, 200],
          [-400, -300],
        ])
      ).toEqual([null, null]);
      expect(
        getClockDriftShifts([
          [100, 200],
          [150, 250],
          [-400, -300],
          [-350, -250],
        ])
      ).toEqual([null, null, null, null]);
    });

    it('does not correct requests if the majority agrees no correction is needed', () => {
      expect(
        getClockDriftShifts([
          [-100, 200],
          [-50, 300],
          [400, 500],
        ])
      ).toEqual([0, 0, null]);
    });

    it('treats requests that miss each other by less than the tolerance as agreeing', () => {
      // No shift fits both exactly, so both end up 2.5ms off
      expect(
        getClockDriftShifts([
          [100, 200],
          [205, 300],
        ])
      ).toEqual([202.5, 202.5]);
    });

    it('skips requests that cannot be aligned', () => {
      expect(getClockDriftShifts([[100, 200], null])).toEqual([100, null]);
    });
  });

  describe('trace tree', () => {
    it('moves a server span that started before the request was sent (client clock ahead by 2min)', () => {
      // client 481ms, server 121ms, recorded 121s before the client span
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 480.8,
            serverStartGap: -121_056.4,
            serverDuration: 121.4,
          }),
        ])
      );

      const server = findSpan(tree, 'server-1');
      expect(server.clockDriftOffsetMs).toBeCloseTo(121_056.4);
      expect(server.isClockDriftCorrectionRoot).toBe(true);
      expect(displayedGaps(tree, '1').start).toBeCloseTo(0);
      // The recorded timestamps are untouched
      expect(server.startTimestamp).toBeCloseTo(T - 121.0564);
    });

    it('moves a server span that ended after the response was received (client clock behind by 20s)', () => {
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 537,
            serverStartGap: 20_655.9,
            serverDuration: 287.2,
          }),
        ])
      );

      expect(findSpan(tree, 'server-1').clockDriftOffsetMs).toBeCloseTo(-20_406.1);
      expect(displayedGaps(tree, '1').end).toBeCloseTo(0);
    });

    it('moves all requests of a client by the same amount', () => {
      // 7 requests from the same browser, recorded 295-300ms late
      const recorded = [
        [161.4, 99.6, 358.9],
        [190.6, 128.9, 361.2],
        [180.7, 112.6, 365.6],
        [198.7, 129.1, 368.3],
        [299.7, 221.9, 373],
        [183.5, 125.5, 355.6],
        [195.3, 142.4, 350.3],
      ] as const;

      const tree = build(
        makePageload(
          recorded.map(([clientDuration, serverDuration, serverStartGap], index) =>
            makeRequest({
              id: `${index}`,
              clientStart: index * 1000,
              clientDuration,
              serverDuration,
              serverStartGap,
            })
          )
        )
      );

      const offsets = recorded.map(
        (_, index) => findSpan(tree, `server-${index}`).clockDriftOffsetMs
      );
      // The tightest request decides the shift, and every request gets it
      for (const offset of offsets) {
        expect(offset).toBeCloseTo(-299.5);
      }
      recorded.forEach((_, index) => {
        const gaps = displayedGaps(tree, `${index}`);
        expect(gaps.start).toBeGreaterThanOrEqual(-1e-6);
        expect(gaps.end).toBeGreaterThanOrEqual(-1e-6);
      });
    });

    it('moves the requests of each segment by their own shared amount', () => {
      // Two hosts of the same service, with clocks that disagree in different directions
      const tree = build(
        makeEAPTrace([
          makeSegment('a', [
            makeRequest({
              id: 'a1',
              clientStart: 0,
              clientDuration: 161.4,
              serverStartGap: 358.9,
              serverDuration: 99.6,
            }),
            makeRequest({
              id: 'a2',
              clientStart: 1000,
              clientDuration: 195.3,
              serverStartGap: 350.3,
              serverDuration: 142.4,
            }),
          ]),
          makeSegment('b', [
            makeRequest({
              id: 'b1',
              clientStart: 0,
              clientDuration: 400,
              serverStartGap: -150,
              serverDuration: 100,
            }),
          ]),
        ])
      );

      // Each request on host A alone would need a slightly different shift, they get the one
      // that fits both
      expect(findSpan(tree, 'server-a1').clockDriftOffsetMs).toBeCloseTo(-297.4);
      expect(findSpan(tree, 'server-a2').clockDriftOffsetMs).toBeCloseTo(-297.4);
      expect(findSpan(tree, 'server-b1').clockDriftOffsetMs).toBeCloseTo(150);
    });

    it('does not move a request that disagrees with the other requests of its segment', () => {
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 161.4,
            serverStartGap: 358.9,
            serverDuration: 99.6,
          }),
          makeRequest({
            id: '2',
            clientStart: 1000,
            clientDuration: 195.3,
            serverStartGap: 350.3,
            serverDuration: 142.4,
          }),
          // Off in the other direction, which the browser's clock can't explain
          makeRequest({
            id: '3',
            clientStart: 2000,
            clientDuration: 400,
            serverStartGap: -150,
            serverDuration: 100,
          }),
        ])
      );

      expect(findSpan(tree, 'server-1').clockDriftOffsetMs).toBeCloseTo(-297.4);
      expect(findSpan(tree, 'server-2').clockDriftOffsetMs).toBeCloseTo(-297.4);
      expect(findSpan(tree, 'server-3').isClockDriftCorrectionRoot).toBe(false);
      expect(findSpan(tree, 'server-3').clockDriftOffsetMs).toBe(0);
    });

    it('moves the whole server subtree, including issues', () => {
      const serverStart = T + ms(-1366);
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 287.6,
            serverStartGap: -1366,
            serverDuration: 186.6,
            serverChildren: [
              makeEAPSpan({
                event_id: 'db',
                op: 'db',
                project_id: 2,
                sdk_name: 'sentry.python.django',
                start_timestamp: serverStart + ms(20),
                end_timestamp: serverStart + ms(50),
              }),
            ],
          }),
        ])
      );

      const server = findSpan(tree, 'server-1');
      const db = findSpan(tree, 'db');

      expect(server.clockDriftOffsetMs).toBeCloseTo(1366);
      expect(server.isClockDriftCorrectionRoot).toBe(true);
      expect(db.clockDriftOffsetMs).toBeCloseTo(1366);
      expect(db.isClockDriftCorrectionRoot).toBe(false);
      expect(db.space[0] - server.space[0]).toBeCloseTo(20);
    });

    it('gives autogroups in a moved subtree the offset of the spans they wrap', () => {
      const serverStart = T + ms(-1366);
      const span = (
        id: string,
        op: string,
        children: Array<ReturnType<typeof makeEAPSpan>> = []
      ) =>
        makeEAPSpan({
          event_id: id,
          op,
          project_id: 2,
          start_timestamp: serverStart + ms(20),
          end_timestamp: serverStart + ms(50),
          children,
        });

      const tree = TraceTree.FromTrace(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 287.6,
            serverStartGap: -1366,
            serverDuration: 186.6,
            serverChildren: [
              span('middleware-1', 'middleware', [span('middleware-2', 'middleware')]),
              ...[1, 2, 3, 4, 5].map(i => span(`db-${i}`, 'db')),
            ],
          }),
        ]),
        {
          replay: null,
          organization,
          preferences: {...preferences, autogroup: {parent: true, sibling: true}},
        }
      );

      const parentGroup = tree.root.findChild(isParentAutogroupedNode);
      const siblingGroup = tree.root.findChild(isSiblingAutogroupedNode);

      expect(parentGroup?.clockDriftOffsetMs).toBeCloseTo(1366);
      expect(siblingGroup?.clockDriftOffsetMs).toBeCloseTo(1366);
    });

    it('does not move server spans that fit inside their client span', () => {
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 400,
            serverStartGap: 170,
            serverDuration: 200,
          }),
        ])
      );

      expect(collectClockDriftCorrections(tree.root)).toHaveLength(0);
    });

    it('does not move server spans that are less than the threshold off', () => {
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 400,
            serverStartGap: -(MIN_CLOCK_DRIFT_CORRECTION_MS - 1),
            serverDuration: 200,
          }),
        ])
      );

      expect(collectClockDriftCorrections(tree.root)).toHaveLength(0);
    });

    it('moves server spans that are at least the threshold off', () => {
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 400,
            serverStartGap: -MIN_CLOCK_DRIFT_CORRECTION_MS,
            serverDuration: 200,
          }),
        ])
      );

      expect(findSpan(tree, 'server-1').clockDriftOffsetMs).toBeCloseTo(
        MIN_CLOCK_DRIFT_CORRECTION_MS
      );
    });

    it('does not move server spans that are longer than their client span', () => {
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 100,
            serverStartGap: 50,
            serverDuration: 300,
          }),
        ])
      );

      expect(collectClockDriftCorrections(tree.root)).toHaveLength(0);
    });

    it('moves server spans of full-stack frameworks that share the project and sdk', () => {
      // e.g. Next.js reports the browser and the server under the same project and SDK name
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 100,
            serverStartGap: -500,
            serverDuration: 50,
            serverProjectId: 1,
            serverSdkName: 'sentry.javascript.react',
          }),
        ])
      );

      expect(findSpan(tree, 'server-1').clockDriftOffsetMs).toBeCloseTo(500);
    });

    it('does not move server spans that do not start a new segment', () => {
      // Same process, so the same clock
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 100,
            serverStartGap: -500,
            serverDuration: 50,
            serverIsSegment: false,
          }),
        ])
      );

      expect(collectClockDriftCorrections(tree.root)).toHaveLength(0);
    });

    it('does not correct anything if the preference is disabled', () => {
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 480.8,
            serverStartGap: -121_056.4,
            serverDuration: 121.4,
          }),
        ]),
        false
      );

      expect(collectClockDriftCorrections(tree.root)).toHaveLength(0);
    });

    it('restores the recorded spaces when removed, and can be applied again', () => {
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 537,
            serverStartGap: 20_655.9,
            serverDuration: 287.2,
          }),
        ])
      );
      const server = findSpan(tree, 'server-1');
      const recordedStart = server.startTimestamp! * 1e3;

      removeClockDriftCorrection(tree.root);
      expect(server.space[0]).toBe(recordedStart);
      expect(server.clockDriftOffsetMs).toBe(0);
      expect(server.isClockDriftCorrectionRoot).toBe(false);

      expect(applyClockDriftCorrection(tree.root)).toBe(1);
      expect(server.clockDriftOffsetMs).toBeCloseTo(-20_406.1);
    });

    it('does not stretch the trace space to where misaligned spans were recorded', () => {
      const trace = makePageload([
        makeRequest({
          id: '1',
          clientStart: 0,
          clientDuration: 480.8,
          serverStartGap: -121_056.4,
          serverDuration: 121.4,
        }),
      ]);

      // The pageload starts 10s before the request, the server span was recorded 121s before it
      expect(build(trace).root.space[0]).toBeCloseTo((T - 10) * 1e3);
      expect(build(trace, false).root.space[0]).toBeCloseTo((T - 121.0564) * 1e3);
    });

    it('updates the trace space when the correction is removed', () => {
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 480.8,
            serverStartGap: -121_056.4,
            serverDuration: 121.4,
          }),
        ])
      );
      const onTimelineChange = jest.fn();
      tree.on('trace timeline change', onTimelineChange);

      removeClockDriftCorrection(tree.root);
      tree.refreshTraceSpace();

      expect(tree.root.space[0]).toBeCloseTo((T - 121.0564) * 1e3);
      expect(onTimelineChange).toHaveBeenCalledWith(tree.root.space);

      applyClockDriftCorrection(tree.root);
      tree.refreshTraceSpace();

      expect(tree.root.space[0]).toBeCloseTo((T - 10) * 1e3);
    });

    it('moves services called by a moved server along with it', () => {
      const serverStart = T + ms(-1000);
      const tree = build(
        makePageload([
          makeRequest({
            id: '1',
            clientStart: 0,
            clientDuration: 300,
            serverStartGap: -1000,
            serverDuration: 200,
            serverChildren: [
              makeEAPSpan({
                event_id: 'client-nested',
                op: 'http.client',
                project_id: 2,
                sdk_name: 'sentry.python.django',
                start_timestamp: serverStart + ms(50),
                end_timestamp: serverStart + ms(150),
                children: [
                  makeEAPSpan({
                    event_id: 'server-nested',
                    op: 'http.server',
                    is_transaction: true,
                    project_id: 3,
                    sdk_name: 'sentry.python',
                    start_timestamp: serverStart + ms(60),
                    end_timestamp: serverStart + ms(140),
                  }),
                ],
              }),
            ],
          }),
        ])
      );

      const nested = findSpan(tree, 'server-nested');
      expect(nested.clockDriftOffsetMs).toBeCloseTo(1000);
      // Its own clock agrees with its caller, so it is not corrected on its own
      expect(nested.isClockDriftCorrectionRoot).toBe(false);
      expect(collectClockDriftCorrections(tree.root)).toHaveLength(1);
    });
  });
});
