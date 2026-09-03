import {buildRouteVisits} from './routeVisits';
import type {Row} from './rowConfig';

const START = Date.parse('2024-01-01T00:00:00+00:00');
const BOUNDS = {start: START, end: START + 60_000};

/**
 * An arrival span at `offset` seconds into the session, shaped the way the events
 * endpoint returns one: `span.name` is the span's own name, `transaction` is the
 * enclosing *segment's* name and defaults to agreeing with it.
 */
function arrival(offset: number, route: string, op = 'navigation', extra: Row = {}): Row {
  return {
    timestamp: new Date(START + offset * 1000).toISOString(),
    'span.op': op,
    'span.name': route,
    transaction: route,
    ...extra,
  };
}

/**
 * An arrival in a trace that holds another segment span, so the segment name it was
 * stamped with belongs to that other segment rather than to this arrival.
 */
function arrivalInSharedTrace(
  offset: number,
  destination: string,
  stampedTransaction: string,
  op = 'navigation'
): Row {
  return {
    timestamp: new Date(START + offset * 1000).toISOString(),
    'span.op': op,
    'span.name': destination,
    transaction: stampedTransaction,
  };
}

describe('buildRouteVisits', () => {
  it('runs each visit up to the next arrival, and the last one to the session end', () => {
    const visits = buildRouteVisits(
      [arrival(0, '/', 'pageload'), arrival(10, '/cart'), arrival(25, '/checkout')],
      BOUNDS
    );

    expect(visits).toEqual([
      {colorIndex: 0, op: 'pageload', route: '/', start: START, end: START + 10_000},
      {
        colorIndex: 1,
        op: 'navigation',
        route: '/cart',
        start: START + 10_000,
        end: START + 25_000,
      },
      {
        colorIndex: 2,
        op: 'navigation',
        route: '/checkout',
        start: START + 25_000,
        end: BOUNDS.end,
      },
    ]);
  });

  it('ignores an arrival span duration entirely', () => {
    // A pageload's own duration is how long the page took to load. Dwell is the
    // gap to the next arrival, and the two are nowhere near each other.
    const visits = buildRouteVisits(
      [
        arrival(0, '/', 'pageload', {'span.duration': 1200}),
        arrival(40, '/cart', 'navigation', {'span.duration': 90}),
      ],
      BOUNDS
    );

    expect(visits[0]!.end - visits[0]!.start).toBe(40_000);
    expect(visits[1]!.end - visits[1]!.start).toBe(20_000);
  });

  it('gives a route the same color every time it is visited', () => {
    const visits = buildRouteVisits(
      [arrival(0, '/cart'), arrival(10, '/checkout'), arrival(20, '/cart')],
      BOUNDS
    );

    expect(visits.map(visit => visit.route)).toEqual(['/cart', '/checkout', '/cart']);
    expect(visits[0]!.colorIndex).toBe(visits[2]!.colorIndex);
    expect(visits[1]!.colorIndex).not.toBe(visits[0]!.colorIndex);
  });

  it('merges a same-route arrival that lands within the same instant', () => {
    // A query-param change or a re-render firing a second navigation span, where a
    // boundary really would mark nothing.
    const visits = buildRouteVisits(
      [arrival(0, '/cart'), arrival(0.4, '/cart'), arrival(30, '/checkout')],
      BOUNDS
    );

    expect(visits).toHaveLength(2);
    expect(visits[0]).toMatchObject({route: '/cart', start: START, end: START + 30_000});
  });

  it('keeps a same-route arrival that is a real navigation back', () => {
    // Seconds apart is a person, not an artifact. Collapsing on the name alone made
    // a genuine router.push vanish whenever the route before it resolved the same
    // way — two segments of one color divided by a rule is the honest drawing.
    const visits = buildRouteVisits(
      [arrival(0, '/'), arrival(9, '/'), arrival(30, '/checkout')],
      BOUNDS
    );

    expect(visits.map(visit => visit.route)).toEqual(['/', '/', '/checkout']);
    expect(visits[0]).toMatchObject({start: START, end: START + 9_000});
    expect(visits[1]).toMatchObject({start: START + 9_000, end: START + 30_000});
    // Same route, so the same color either side of the boundary.
    expect(visits[0]!.colorIndex).toBe(visits[1]!.colorIndex);
  });

  it('sorts arrivals, whatever order the rows arrived in', () => {
    const visits = buildRouteVisits(
      [arrival(20, '/checkout'), arrival(0, '/'), arrival(10, '/cart')],
      BOUNDS
    );

    expect(visits.map(visit => visit.route)).toEqual(['/', '/cart', '/checkout']);
  });

  it('leaves a gap when the session starts before its first arrival', () => {
    // Telemetry from before the SDK saw a pageload: the route in that stretch is
    // genuinely unknown, so nothing is drawn there.
    const visits = buildRouteVisits([arrival(15, '/cart', 'pageload')], BOUNDS);

    expect(visits[0]!.start).toBe(START + 15_000);
  });

  it('clamps an arrival before the extent instead of dropping it', () => {
    // `timestamp` is coarser than the `precise.start_ts` the extent comes from, so
    // an arrival can land a fraction of a second early. The user was already on
    // that route when the extent opened.
    const visits = buildRouteVisits([arrival(-5, '/cart', 'pageload')], BOUNDS);

    expect(visits).toEqual([
      {
        colorIndex: 0,
        op: 'pageload',
        route: '/cart',
        start: START,
        end: BOUNDS.end,
      },
    ]);
  });

  it('drops an earlier arrival that clamps onto the same start', () => {
    const visits = buildRouteVisits(
      [arrival(-10, '/', 'pageload'), arrival(-2, '/cart')],
      BOUNDS
    );

    expect(visits.map(visit => visit.route)).toEqual(['/cart']);
    expect(visits[0]!.start).toBe(START);
  });

  it('drops a zero-width stay without opening a gap', () => {
    const visits = buildRouteVisits(
      [arrival(0, '/'), arrival(10, '/cart'), arrival(10, '/checkout')],
      BOUNDS
    );

    expect(visits.map(visit => visit.route)).toEqual(['/', '/checkout']);
    expect(visits[0]!.end).toBe(START + 10_000);
    expect(visits[1]!.start).toBe(START + 10_000);
  });

  it('drops an arrival past the end of the extent', () => {
    const visits = buildRouteVisits([arrival(0, '/'), arrival(120, '/cart')], BOUNDS);

    expect(visits.map(visit => visit.route)).toEqual(['/']);
    expect(visits[0]!.end).toBe(BOUNDS.end);
  });

  it('falls back to the span description when the transaction is unnamed', () => {
    const visits = buildRouteVisits(
      [
        {
          timestamp: new Date(START).toISOString(),
          'span.op': 'navigation',
          is_transaction: true,
          'span.description': '/products/:id',
        },
      ],
      BOUNDS
    );

    expect(visits[0]!.route).toBe('/products/:id');
  });

  it('draws the navigation from a real nextjs session that used to vanish', () => {
    // Verbatim shape of the reported span: op `navigation`, every naming field `/`,
    // is_transaction true, arriving 9s after a ui.interaction.click in the same
    // trace. With the route before it also resolving to `/`, the old name-only
    // merge discarded it and the band showed no arrival at all.
    const clickAt = Date.parse('2026-08-18T11:38:58Z');
    const bounds = {start: clickAt - 30_000, end: clickAt + 60_000};

    const visits = buildRouteVisits(
      [
        {
          timestamp: '2026-08-18T11:38:40Z',
          'span.op': 'navigation',
          'span.name': '/',
          'span.description': '/',
          transaction: '/',
        },
        {
          timestamp: '2026-08-18T11:39:07Z',
          'span.op': 'navigation',
          'span.name': '/',
          'span.description': '/',
          transaction: '/',
        },
      ],
      bounds
    );

    expect(visits).toHaveLength(2);
    expect(visits[1]!.start).toBe(Date.parse('2026-08-18T11:39:07Z'));
  });

  describe('naming an arrival', () => {
    it('names an arrival by its own span name, not by the segment stamped on it', () => {
      // The bug this guards. `transaction` resolves to `sentry.segment_name`, which
      // one chosen segment span stamps across its whole batch — and the pipeline
      // documents a batch with several segment spans as undefined behavior. In a
      // trace holding a ui.action.click segment as well as the navigation, the
      // navigation can carry the click's route: the page the user was *leaving*.
      // Naming the arrival from that made the merge below discard it, so a real
      // navigation drew no new route.
      const visits = buildRouteVisits(
        [
          arrival(0, '/products', 'pageload'),
          arrivalInSharedTrace(20, '/cart', '/products'),
        ],
        BOUNDS
      );

      expect(visits.map(visit => visit.route)).toEqual(['/products', '/cart']);
      expect(visits[0]!.end).toBe(START + 20_000);
      expect(visits[1]!.start).toBe(START + 20_000);
    });

    it('does the same for a redirect, which is a child span rather than a segment', () => {
      const visits = buildRouteVisits(
        [
          arrival(0, '/products', 'pageload'),
          arrivalInSharedTrace(20, '/cart', '/products', 'navigation.redirect'),
        ],
        BOUNDS
      );

      expect(visits.map(visit => visit.route)).toEqual(['/products', '/cart']);
      expect(visits[1]!.op).toBe('navigation.redirect');
    });

    it('falls back to the description, then to the transaction', () => {
      const visits = buildRouteVisits(
        [
          {
            timestamp: new Date(START).toISOString(),
            'span.op': 'pageload',
            'span.description': '/from-description',
          },
          {
            timestamp: new Date(START + 20_000).toISOString(),
            'span.op': 'navigation',
            transaction: '/from-transaction',
          },
        ],
        BOUNDS
      );

      expect(visits.map(visit => visit.route)).toEqual([
        '/from-description',
        '/from-transaction',
      ]);
    });

    it('skips an arrival that names no route at all', () => {
      const visits = buildRouteVisits(
        [{timestamp: new Date(START).toISOString(), 'span.op': 'navigation.redirect'}],
        BOUNDS
      );

      expect(visits).toEqual([]);
    });
  });

  it('skips rows that are not arrivals, or cannot place themselves', () => {
    const visits = buildRouteVisits(
      [
        arrival(0, '/checkout', 'http.server'),
        arrival(5, '/cart', 'ui.action.click'),
        {timestamp: new Date(START).toISOString(), 'span.op': 'navigation'},
        {'span.op': 'pageload', transaction: '/cart'},
        {
          timestamp: 'not-a-date',
          'span.op': 'pageload',
          transaction: '/cart',
        },
      ],
      BOUNDS
    );

    expect(visits).toEqual([]);
  });

  it('has nothing to draw against without an extent', () => {
    expect(buildRouteVisits([arrival(0, '/')], undefined)).toEqual([]);
  });
});
