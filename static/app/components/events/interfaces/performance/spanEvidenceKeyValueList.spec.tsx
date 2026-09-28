import {EntryRequestFixture} from 'sentry-fixture/eventEntry';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  MockSpan,
  ProblemSpan,
  TransactionEventBuilder,
} from 'sentry-test/performance/utils';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {EventTransaction} from 'sentry/types/event';
import {IssueType} from 'sentry/types/group';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';
import {extractQueryParameters, extractSpanURLString} from './spanMetrics';

describe('SpanEvidenceKeyValueList', () => {
  const projectSlug = 'project';

  describe('N+1 and MN+1 Database Queries', () => {
    type OffenderSpan = {
      description: string;
      op: string;
      data?: Record<string, any>;
      hash?: string;
    };
    type BuildEventOptions = {
      patternSize?: number;
    };

    function buildEvent(
      // N+1 and MN+1 DB issues render the same span evidence component, because they share a group
      // type, the only differences being how many distinct queries the offending spans contain - an
      // N+1 repeats a single query, while an MN+1 repeats a pattern of several - and the inclusion
      // of `patternSize` in MN+1 span evidence.
      offendingSpans: OffenderSpan[],
      {patternSize}: BuildEventOptions = {}
    ) {
      const builder = new TransactionEventBuilder('a1', '/dogpark');
      builder.getEventFixture().projectID = '123';

      const parentSpan = new MockSpan({
        startTimestamp: 0,
        endTimestamp: 0.2,
        op: 'http.server',
        problemSpan: ProblemSpan.PARENT,
      });

      offendingSpans.forEach((span, i) => {
        parentSpan.addChild({
          startTimestamp: i,
          endTimestamp: i + 1,
          problemSpan: ProblemSpan.OFFENDER,
          ...span,
        });
      });

      builder.addSpan(parentSpan);
      const event = builder.getEventFixture();

      if (patternSize !== undefined) {
        event.occurrence = {
          ...event.occurrence,
          evidenceData: {...event.occurrence?.evidenceData, patternSize},
        } as EventTransaction['occurrence'];
      }

      return event;
    }

    it('renders relevant fields', () => {
      // A plain N+1: the same query, run twice
      const event = buildEvent([
        {
          op: 'db',
          description: 'SELECT * FROM dogs WHERE id = 1121',
          hash: 'dog_pack',
        },
        {
          op: 'db',
          description: 'SELECT * FROM dogs WHERE id = 1231',
          hash: 'dog_pack',
        },
      ]);

      render(<SpanEvidenceKeyValueList event={event} projectSlug={projectSlug} />);

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/dogpark');
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction').querySelector('a')
      ).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/summary/?project=123&referrer=performance-transaction-summary&transaction=%2Fdogpark&unselectedSeries=p100%28%29&unselectedSeries=avg%28%29'
      );
      expect(screen.getByRole('button', {name: 'View Full Trace'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/explore/traces/trace/8cbbc19c0f54447ab702f00263262726/?eventId=a1&statsPeriod=14d&timestamp=2'
      );

      expect(screen.getByRole('cell', {name: 'Parent Span'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.parent-span')
      ).toHaveTextContent('http.server');

      // Both spans are the same query, so they collapse into a single row, labelled with the
      // number of offending spans
      expect(screen.getByRole('cell', {name: 'Repeating Spans (2)'})).toBeInTheDocument();

      // In the span evidence table, the first row gets a different test id than the rest. They all
      // start with `span-evidence-key-value-list.`, but the first row also has
      // `repeating-spans-<repeating_span_count>` on the end.
      expect(
        screen.getByTestId('span-evidence-key-value-list.repeating-spans-2')
      ).toHaveTextContent('SELECT * FROM dogs WHERE id = 1121');
      const remainingTableRows = screen.queryAllByTestId('span-evidence-key-value-list.');
      expect(remainingTableRows).toHaveLength(0);

      // These belong to N+1 API Calls, and shouldn't show up for a DB issue
      expect(screen.queryByRole('cell', {name: 'Parameter'})).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('span-evidence-key-value-list.problem-parameters')
      ).not.toBeInTheDocument();

      // Only MN+1 issues have a pattern
      expect(screen.queryByRole('cell', {name: 'Pattern Size'})).not.toBeInTheDocument();
    });

    it('renders the pattern size for MN+1 issues', () => {
      const pattern = [
        {
          op: 'db',
          description: 'SELECT * FROM dogs WHERE id = 1121',
          hash: 'dog_pack',
        },
        {
          op: 'db',
          description: 'SELECT * FROM dogs WHERE id = 1231',
          hash: 'dog_pack',
        },
        {
          op: 'db',
          description: 'SELECT * FROM tricks WHERE id = 908',
          hash: 'talent_show',
        },
      ];
      const event = buildEvent([...pattern, ...pattern], {patternSize: 3});

      render(<SpanEvidenceKeyValueList event={event} projectSlug={projectSlug} />);

      expect(screen.getByRole('cell', {name: 'Pattern Size'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.pattern-size')
      ).toHaveTextContent('3');
    });

    it('leaves spans which are not db spans out of the repeating span rows', () => {
      // An MN+1 pattern can include spans which aren't queries at all - that's the "interspersed
      // with other spans" part of what the detector looks for.
      const pattern = [
        {
          op: 'db',
          description: 'SELECT * FROM dogs WHERE id = 1121',
          hash: 'dog_pack',
        },
        {
          op: 'db',
          description: 'SELECT * FROM dogs WHERE id = 1231',
          hash: 'dog_pack',
        },
        {
          op: 'cache.get',
          description: 'dog_leaderboard',
          hash: 'cached_leaderboard',
        },
        {
          op: 'db',
          description: 'SELECT * FROM tricks WHERE id = 908',
          hash: 'talent_show',
        },
      ];
      const event = buildEvent([...pattern, ...pattern], {patternSize: 4});

      render(<SpanEvidenceKeyValueList event={event} projectSlug={projectSlug} />);

      const firstRow = screen.getByTestId(
        'span-evidence-key-value-list.repeating-spans-6'
      );
      const unlabelledRows = screen.getAllByTestId('span-evidence-key-value-list.');

      expect(firstRow).toHaveTextContent('SELECT * FROM dogs WHERE id = 1121');
      expect(unlabelledRows).toHaveLength(1);
      expect(unlabelledRows[0]).toHaveTextContent('SELECT * FROM tricks WHERE id = 908');
      expect(
        screen.getByTestId('span-evidence-key-value-list.pattern-size')
      ).toHaveTextContent('4');

      // Only the db spans get rows, so the cache span isn't rendered at all
      expect(screen.getByRole('table')).not.toHaveTextContent('dog_leaderboard');
    });

    it.each([
      ['transaction-derived', (hash: string) => ({hash})],
      ['segment-derived', (hash: string) => ({data: {hash}})],
    ])(
      'dedupes rows by hash value rather than description, %s spans',
      (_label, hashLocation) => {
        // The two `dogs` queries differ in description but share a hash value, because our hashing
        // calculation parameterizes query literals. They should collapse into a single row - if we
        // compared descriptions instead, they'd get a row each.
        const event = buildEvent([
          {
            op: 'db',
            description: 'SELECT * FROM dogs WHERE id = 1121',
            ...hashLocation('dog_pack'),
          },
          {
            op: 'db',
            description: 'SELECT * FROM dogs WHERE id = 1231',
            ...hashLocation('dog_pack'),
          },
          {
            op: 'db',
            description: 'SELECT * FROM tricks WHERE id = 908',
            ...hashLocation('talent_show'),
          },
        ]);

        render(<SpanEvidenceKeyValueList event={event} projectSlug={projectSlug} />);

        // Only the first row is labelled, and the number it carries is the total count of offending
        // spans - not the number of rows, and not the number of times the first row's query ran.
        // Here that's three offending spans rendered as two rows, the first of which stands in for
        // two spans.
        const firstRow = screen.getByTestId(
          'span-evidence-key-value-list.repeating-spans-3'
        );
        const unlabelledRows = screen.getAllByTestId('span-evidence-key-value-list.');

        expect(firstRow).toHaveTextContent('SELECT * FROM dogs WHERE id = 1121');
        expect(unlabelledRows).toHaveLength(1);
        expect(unlabelledRows[0]).toHaveTextContent(
          'SELECT * FROM tricks WHERE id = 908'
        );

        // The second `dogs` query shares a hash with the first, so it gets no row of its own
        expect(screen.getByRole('table')).not.toHaveTextContent(
          'SELECT * FROM dogs WHERE id = 1231'
        );
      }
    );
  });

  describe('Consecutive DB Queries', () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES
    );
    builder.getEventFixture().projectID = '123';

    const parentSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 0.65,
      op: 'http.server',
      problemSpan: ProblemSpan.PARENT,
    });

    parentSpan.addChild({
      startTimestamp: 0.1,
      endTimestamp: 0.2,
      op: 'db',
      description: 'SELECT * FROM USERS LIMIT 100',
      problemSpan: ProblemSpan.CAUSE,
    });

    parentSpan.addChild({
      startTimestamp: 0.2,
      endTimestamp: 0.4,
      op: 'db',
      description: 'SELECT COUNT(*) FROM USERS',
      problemSpan: [ProblemSpan.CAUSE, ProblemSpan.OFFENDER],
    });

    parentSpan.addChild({
      startTimestamp: 0.4,
      endTimestamp: 0.6,
      op: 'db',
      description: 'SELECT COUNT(*) FROM ITEMS',
      problemSpan: [ProblemSpan.CAUSE, ProblemSpan.OFFENDER],
    });

    builder.addSpan(parentSpan);

    it('Renders relevant fields', () => {
      render(
        <SpanEvidenceKeyValueList
          event={builder.getEventFixture()}
          projectSlug={projectSlug}
        />
      );

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/');
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction').querySelector('a')
      ).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/summary/?project=123&referrer=performance-transaction-summary&transaction=%2F&unselectedSeries=p100%28%29&unselectedSeries=avg%28%29'
      );
      expect(screen.getByRole('button', {name: 'View Full Trace'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/explore/traces/trace/8cbbc19c0f54447ab702f00263262726/?eventId=a1&statsPeriod=14d&timestamp=0.65'
      );

      expect(screen.getByRole('cell', {name: 'Starting Span'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.starting-span')
      ).toHaveTextContent('SELECT * FROM USERS LIMIT 100');

      expect(screen.queryAllByRole('cell', {name: 'Parallelizable Spans'})).toHaveLength(
        1
      );
      const parallelizableSpanKeyValue = screen.getByTestId(
        'span-evidence-key-value-list.parallelizable-spans'
      );

      expect(parallelizableSpanKeyValue).toHaveTextContent('SELECT COUNT(*) FROM USERS');
      expect(parallelizableSpanKeyValue).toHaveTextContent('SELECT COUNT(*) FROM ITEMS');

      expect(
        screen.getByTestId('span-evidence-key-value-list.duration-impact')
      ).toHaveTextContent('46% (300ms/650ms)');
    });
  });

  describe('Consecutive HTTP', () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_CONSECUTIVE_HTTP
    );
    builder.getEventFixture().projectID = '123';

    const parentSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 0.65,
      op: 'http.client',
      problemSpan: ProblemSpan.PARENT,
    });

    parentSpan.addChild({
      startTimestamp: 0.1,
      endTimestamp: 0.2,
      op: 'http.client',
      description: 'GET /endpoint1',
      problemSpan: ProblemSpan.OFFENDER,
    });
    parentSpan.addChild({
      startTimestamp: 0.2,
      endTimestamp: 0.3,
      op: 'http.client',
      description: 'GET /endpoint2',
      problemSpan: ProblemSpan.OFFENDER,
    });
    parentSpan.addChild({
      startTimestamp: 0.3,
      endTimestamp: 0.4,
      op: 'http.client',
      description: 'GET /endpoint3',
      problemSpan: ProblemSpan.OFFENDER,
    });

    builder.addSpan(parentSpan);

    it('Renders relevant fields', () => {
      render(
        <SpanEvidenceKeyValueList
          event={builder.getEventFixture()}
          projectSlug={projectSlug}
        />
      );

      const parallelizableSpanKeyValue = screen.getByTestId(
        'span-evidence-key-value-list.offending-spans'
      );

      expect(parallelizableSpanKeyValue).toHaveTextContent('GET /endpoint1');
      expect(parallelizableSpanKeyValue).toHaveTextContent('GET /endpoint2');
      expect(parallelizableSpanKeyValue).toHaveTextContent('GET /endpoint3');
    });
  });

  describe('N+1 API Calls', () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS
    );
    builder.getEventFixture().projectID = '123';

    const parentSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 200,
      op: 'pageload',
      problemSpan: ProblemSpan.PARENT,
    });

    parentSpan.addChild({
      startTimestamp: 10,
      endTimestamp: 2100,
      op: 'http.client',
      description: 'GET /book/?book_id=7&sort=up',
      problemSpan: ProblemSpan.OFFENDER,
    });

    parentSpan.addChild({
      startTimestamp: 10,
      endTimestamp: 2100,
      op: 'http.client',
      description: 'GET /user/123/book/?book_id=8&sort=down',
      problemSpan: ProblemSpan.OFFENDER,
    });

    builder.addSpan(parentSpan);

    builder.addEntry(
      EntryRequestFixture({
        data: {
          ...EntryRequestFixture().data,
          url: 'http://some.service.io',
        },
      })
    );

    it('Renders relevant fields', () => {
      const event = builder.getEventFixture();
      event.occurrence = {
        ...event.occurrence,
        subtitle: '/user/*/book/?book_id=*',
        evidenceData: {
          ...event.occurrence?.evidenceData,
          pathParameters: ['123'],
        },
      } as EventTransaction['occurrence'];

      render(
        <SpanEvidenceKeyValueList
          event={builder.getEventFixture()}
          projectSlug={projectSlug}
        />
      );

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/');
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction').querySelector('a')
      ).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/summary/?project=123&referrer=performance-transaction-summary&transaction=%2F&unselectedSeries=p100%28%29&unselectedSeries=avg%28%29'
      );
      expect(screen.getByRole('button', {name: 'View Full Trace'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/explore/traces/trace/8cbbc19c0f54447ab702f00263262726/?eventId=a1&statsPeriod=14d&timestamp=2100'
      );

      expect(screen.getByRole('cell', {name: 'Repeating Spans (2)'})).toBeInTheDocument();
      expect(
        screen.getByTestId(/span-evidence-key-value-list.repeating-spans/)
      ).toHaveTextContent('/user/*/book/?book_id=*');

      expect(screen.getByRole('cell', {name: 'Query Parameters'})).toBeInTheDocument();

      const queryParamsKeyValue = screen.getByTestId(
        'span-evidence-key-value-list.query-parameters'
      );

      expect(queryParamsKeyValue).toHaveTextContent('book_id:{7,8}');
      expect(queryParamsKeyValue).toHaveTextContent('sort:{up,down}');

      expect(screen.getByRole('cell', {name: 'Path Parameters'})).toBeInTheDocument();
      const pathParamsKeyValue = screen.getByTestId(
        'span-evidence-key-value-list.path-parameters'
      );

      expect(pathParamsKeyValue).toHaveTextContent('123');
    });

    describe('extractSpanURLString', () => {
      it('Tries to pull a URL from the span data', () => {
        expect(
          extractSpanURLString({
            span_id: 'a',
            data: {
              url: 'http://service.io?id=2543',
            },
          })?.toString()
        ).toBe('http://service.io/?id=2543');
      });

      it('Pulls out a relative URL if a base is provided', () => {
        expect(
          extractSpanURLString(
            {
              span_id: 'a',
              data: {
                url: '/item',
              },
            },
            'http://service.io'
          )?.toString()
        ).toBe('http://service.io/item');
      });

      it('Fetches the query string from the span data if available', () => {
        expect(
          extractSpanURLString({
            span_id: 'a',
            description: 'GET http://service.io/item',
            data: {
              url: 'http://service.io/item',
              'http.query': 'id=153',
            },
          })?.toString()
        ).toBe('http://service.io/item?id=153');
      });

      it('Falls back to span description if URL is faulty', () => {
        expect(
          extractSpanURLString({
            span_id: 'a',
            description: 'GET http://service.io/item',
            data: {
              url: '/item',
            },
          })?.toString()
        ).toBe('http://service.io/item');
      });
    });

    describe('extractQueryParameters', () => {
      it('If the URLs have no parameters or are malformed, returns nothing', () => {
        const URLs = [
          new URL('http://service.io/items'),
          new URL('http://service.io/values'),
        ];

        expect(extractQueryParameters(URLs)).toEqual({});
      });

      it('If the URLs have one changing parameter, returns it and its values', () => {
        const URLs = [
          new URL('http://service.io/items?id=4'),
          new URL('http://service.io/items?id=5'),
          new URL('http://service.io/items?id=6'),
        ];

        expect(extractQueryParameters(URLs)).toEqual({
          id: ['4', '5', '6'],
        });
      });

      it('If the URLs have multiple changing parameters, returns them and their values', () => {
        const URLs = [
          new URL('http://service.io/items?id=4&sort=down&filter=none'),
          new URL('http://service.io/items?id=5&sort=up&filter=none'),
          new URL('http://service.io/items?id=6&sort=up&filter=none'),
        ];

        expect(extractQueryParameters(URLs)).toEqual({
          id: ['4', '5', '6'],
          sort: ['down', 'up'],
          filter: ['none'],
        });
      });
    });
  });

  describe('Slow DB Span', () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_SLOW_DB_QUERY
    );
    builder.getEventFixture().projectID = '123';

    const parentSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 200,
      op: 'pageload',
      problemSpan: ProblemSpan.PARENT,
    });

    parentSpan.addChild({
      startTimestamp: 10,
      endTimestamp: 10100,
      op: 'db',
      description: 'SELECT pokemon FROM pokedex',
      problemSpan: ProblemSpan.OFFENDER,
    });
    parentSpan.children[0]!.span.data = {
      'code.filepath': '/app/pokedex/queries.py',
      'code.function': 'fetchPokemon',
      'code.lineno': 42,
    };

    builder.addSpan(parentSpan);

    it('Renders relevant fields', () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [],
      });

      render(
        <SpanEvidenceKeyValueList
          event={builder.getEventFixture()}
          projectSlug={projectSlug}
        />,
        {
          organization: OrganizationFixture({
            features: ['visibility-explore-view'],
          }),
        }
      );

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/');
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction').querySelector('a')
      ).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/summary/?project=123&referrer=performance-transaction-summary&transaction=%2F&unselectedSeries=p100%28%29&unselectedSeries=avg%28%29'
      );
      expect(screen.getByRole('button', {name: 'View Full Trace'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/explore/traces/trace/8cbbc19c0f54447ab702f00263262726/?eventId=a1&statsPeriod=14d&timestamp=10100'
      );

      expect(screen.getByRole('cell', {name: 'Slow DB Query'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.slow-db-query')
      ).toHaveTextContent('SELECT pokemon FROM pokedex');
      expect(
        screen.getByTestId('span-evidence-key-value-list.slow-db-query')
      ).toHaveTextContent('/app/pokedex/queries.py in fetchPokemon at line 42');
      expect(screen.getByRole('cell', {name: 'Duration Impact'})).toBeInTheDocument();

      expect(screen.getByRole('link', {name: 'More Samples'})).toBeInTheDocument();
    });

    it('renders span-specific missing query source copy', () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [],
      });

      const builderWithoutCodeLocation = new TransactionEventBuilder(
        'a1',
        '/',
        IssueType.PERFORMANCE_SLOW_DB_QUERY
      );
      builderWithoutCodeLocation.getEventFixture().projectID = '123';

      const parentSpanWithoutCodeLocation = new MockSpan({
        startTimestamp: 0,
        endTimestamp: 200,
        op: 'pageload',
        problemSpan: ProblemSpan.PARENT,
      });

      parentSpanWithoutCodeLocation.addChild({
        startTimestamp: 10,
        endTimestamp: 10100,
        op: 'db',
        description: 'SELECT pokemon FROM pokedex',
        problemSpan: ProblemSpan.OFFENDER,
      });

      builderWithoutCodeLocation.addSpan(parentSpanWithoutCodeLocation);

      render(
        <SpanEvidenceKeyValueList
          event={builderWithoutCodeLocation.getEventFixture()}
          projectSlug={projectSlug}
        />,
        {
          organization: OrganizationFixture({
            features: ['visibility-explore-view'],
          }),
        }
      );

      const slowDbQuery = screen.getByTestId(
        'span-evidence-key-value-list.slow-db-query'
      );

      expect(slowDbQuery).toHaveTextContent(
        'Query source is not available for this span.'
      );
      expect(slowDbQuery).not.toHaveTextContent('selected date range');
    });
  });

  describe('Render Blocking Asset', () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET,
      {
        duration: 3,
        fcp: 2500,
      }
    );
    builder.getEventFixture().projectID = '123';

    const offenderSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 1,
      op: 'resource.script',
      description: 'https://example.com/resource.js',
      problemSpan: ProblemSpan.OFFENDER,
    });

    builder.addSpan(offenderSpan);

    it('Renders relevant fields', () => {
      render(
        <SpanEvidenceKeyValueList
          event={builder.getEventFixture()}
          projectSlug={projectSlug}
        />
      );

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/');
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction').querySelector('a')
      ).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/summary/?project=123&referrer=performance-transaction-summary&transaction=%2F&unselectedSeries=p100%28%29&unselectedSeries=avg%28%29'
      );
      expect(screen.getByRole('button', {name: 'View Full Trace'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/explore/traces/trace/8cbbc19c0f54447ab702f00263262726/?eventId=a1&statsPeriod=14d&timestamp=3'
      );

      expect(screen.getByRole('cell', {name: 'Slow Resource Span'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.slow-resource-span')
      ).toHaveTextContent('resource.script - https://example.com/resource.js');

      expect(screen.getByRole('cell', {name: 'FCP Delay'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.fcp-delay')
      ).toHaveTextContent('1s (40% of 2.50s)');

      expect(screen.getByRole('cell', {name: 'Duration Impact'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.duration-impact')
      ).toHaveTextContent('33% (1s/3.00s');
    });
  });

  describe('Uncompressed Asset', () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_UNCOMPRESSED_ASSET,
      {
        duration: 0.931, // in seconds
      }
    );
    builder.getEventFixture().projectID = '123';

    const offenderSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 0.487, // in seconds
      op: 'resource.script',
      description: 'https://example.com/resource.js',
      problemSpan: ProblemSpan.OFFENDER,
      data: {
        'http.response_content_length': 31041901,
      },
    });

    builder.addSpan(offenderSpan);

    it('Renders relevant fields', () => {
      render(
        <SpanEvidenceKeyValueList
          event={builder.getEventFixture()}
          projectSlug={projectSlug}
        />
      );

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/');
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction').querySelector('a')
      ).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/summary/?project=123&referrer=performance-transaction-summary&transaction=%2F&unselectedSeries=p100%28%29&unselectedSeries=avg%28%29'
      );
      expect(screen.getByRole('button', {name: 'View Full Trace'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/explore/traces/trace/8cbbc19c0f54447ab702f00263262726/?eventId=a1&statsPeriod=14d&timestamp=0.931'
      );

      expect(screen.getByRole('cell', {name: 'Slow Resource Span'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.slow-resource-span')
      ).toHaveTextContent('resource.script - https://example.com/resource.js');

      expect(screen.getByRole('cell', {name: 'Asset Size'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.asset-size')
      ).toHaveTextContent('29.6 MiB (31041901 B)');

      expect(screen.getByRole('cell', {name: 'Duration Impact'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.duration-impact')
      ).toHaveTextContent('52% (487ms/931ms)');
    });

    describe('With backwards compatible legacy keys', () => {
      const legacyKeyBuilder = new TransactionEventBuilder(
        'a1',
        '/',
        IssueType.PERFORMANCE_UNCOMPRESSED_ASSET,
        {
          duration: 0.931, // in seconds
        }
      );
      legacyKeyBuilder.getEventFixture().projectID = '123';

      const offenderSpanWithLegacyKey = new MockSpan({
        startTimestamp: 0,
        endTimestamp: 0.487, // in seconds
        op: 'resource.script',
        description: 'https://example.com/resource.js',
        problemSpan: ProblemSpan.OFFENDER,
        data: {
          'Encoded Body Size': 31041901,
        },
      });

      legacyKeyBuilder.addSpan(offenderSpanWithLegacyKey);

      it('Renders relevant fields', () => {
        render(
          <SpanEvidenceKeyValueList
            event={legacyKeyBuilder.getEventFixture()}
            projectSlug={projectSlug}
          />
        );

        expect(screen.getByRole('cell', {name: 'Asset Size'})).toBeInTheDocument();
        expect(
          screen.getByTestId('span-evidence-key-value-list.asset-size')
        ).toHaveTextContent('29.6 MiB (31041901 B)');
      });
    });
  });

  describe('Large HTTP Payload', () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_LARGE_HTTP_PAYLOAD
    );
    builder.getEventFixture().projectID = '123';

    const offenderSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 0.487, // in seconds
      op: 'http.client',
      description: 'https://example.com/api/users',
      problemSpan: ProblemSpan.OFFENDER,
      data: {
        'http.response_content_length': 31041901,
      },
    });

    builder.addSpan(offenderSpan);

    it('Renders relevant fields', () => {
      render(
        <SpanEvidenceKeyValueList
          event={builder.getEventFixture()}
          projectSlug={projectSlug}
        />
      );

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/');
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction').querySelector('a')
      ).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/summary/?project=123&referrer=performance-transaction-summary&transaction=%2F&unselectedSeries=p100%28%29&unselectedSeries=avg%28%29'
      );
      expect(screen.getByRole('button', {name: 'View Full Trace'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/explore/traces/trace/8cbbc19c0f54447ab702f00263262726/?eventId=a1&statsPeriod=14d&timestamp=0.487'
      );

      expect(
        screen.getByRole('cell', {name: 'Large HTTP Payload Span'})
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.large-http-payload-span')
      ).toHaveTextContent('http.client - https://example.com/api/users');

      expect(screen.getByRole('cell', {name: 'Payload Size'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.payload-size')
      ).toHaveTextContent('29.6 MiB (31041901 B)');
    });

    describe('With backwards compatible legacy keys', () => {
      const legacyKeyBuilder = new TransactionEventBuilder(
        'a1',
        '/',
        IssueType.PERFORMANCE_LARGE_HTTP_PAYLOAD
      );
      legacyKeyBuilder.getEventFixture().projectID = '123';

      const offenderSpanWithLegacyKey = new MockSpan({
        startTimestamp: 0,
        endTimestamp: 0.487, // in seconds
        op: 'http.client',
        description: 'https://example.com/api/users',
        problemSpan: ProblemSpan.OFFENDER,
        data: {
          'Encoded Body Size': 31041901,
        },
      });

      legacyKeyBuilder.addSpan(offenderSpanWithLegacyKey);
      it('Renders relevant fields', () => {
        render(
          <SpanEvidenceKeyValueList
            event={legacyKeyBuilder.getEventFixture()}
            projectSlug={projectSlug}
          />
        );

        expect(screen.getByRole('cell', {name: 'Payload Size'})).toBeInTheDocument();
        expect(
          screen.getByTestId('span-evidence-key-value-list.payload-size')
        ).toHaveTextContent('29.6 MiB (31041901 B)');
      });
    });
  });
});
