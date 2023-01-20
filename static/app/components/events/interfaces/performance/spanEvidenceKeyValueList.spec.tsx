import {
  MockSpan,
  ProblemSpan,
  TransactionEventBuilder,
} from 'sentry-test/performance/utils';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EntryType, IssueType} from 'sentry/types';

import {
  extractQueryParameters,
  SpanEvidenceKeyValueList,
} from './spanEvidenceKeyValueList';

describe('SpanEvidenceKeyValueList', () => {
  describe('N+1 Database Queries', () => {
    const builder = new TransactionEventBuilder('a1', '/');

    const parentSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 200,
      op: 'http.server',
      problemSpan: ProblemSpan.PARENT,
    });

    parentSpan.addChild({
      startTimestamp: 10,
      endTimestamp: 2100,
      op: 'db',
      description: 'SELECT * FROM books',
      problemSpan: ProblemSpan.OFFENDER,
    });

    parentSpan.addChild({
      startTimestamp: 10,
      endTimestamp: 2100,
      op: 'db',
      description: 'SELECT * FROM books WHERE id = %s',
      problemSpan: ProblemSpan.OFFENDER,
    });

    builder.addSpan(parentSpan);

    it('Renders relevant fields', () => {
      render(<SpanEvidenceKeyValueList event={builder.getEvent()} />);

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/');

      expect(screen.getByRole('cell', {name: 'Parent Span'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.parent-span')
      ).toHaveTextContent('http.server');

      expect(screen.getByRole('cell', {name: 'Repeating Spans (2)'})).toBeInTheDocument();
      expect(
        screen.getByTestId(/span-evidence-key-value-list.repeating-spans/)
      ).toHaveTextContent('db - SELECT * FROM books');

      expect(screen.queryByRole('cell', {name: 'Parameter'})).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('span-evidence-key-value-list.problem-parameters')
      ).not.toBeInTheDocument();
    });
  });

  describe('Consecutive DB Queries', () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES
    );

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

    builder.addSpan(parentSpan);

    it('Renders relevant fields', () => {
      render(<SpanEvidenceKeyValueList event={builder.getEvent()} />);

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/');

      expect(screen.getByRole('cell', {name: 'Starting Span'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.starting-span')
      ).toHaveTextContent('db - SELECT * FROM USERS LIMIT 100');

      expect(
        screen.queryByRole('cell', {name: 'Parallelizable Span'})
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.parallelizable-span')
      ).toHaveTextContent('db - SELECT COUNT(*) FROM USERS');
      expect(
        screen.getByTestId('span-evidence-key-value-list.duration-impact')
      ).toHaveTextContent('15.385% (100ms/650ms)');
    });
  });

  describe('N+1 API Calls', () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS
    );

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
      description: 'GET /book/?book_id=8&sort=down',
      problemSpan: ProblemSpan.OFFENDER,
    });

    builder.addSpan(parentSpan);

    builder.addEntry(
      TestStubs.EventEntry({
        type: EntryType.REQUEST,
        data: {
          url: 'http://some.service.io',
        },
      })
    );

    it('Renders relevant fields', () => {
      render(<SpanEvidenceKeyValueList event={builder.getEvent()} />);

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/');

      expect(screen.getByRole('cell', {name: 'Repeating Spans (2)'})).toBeInTheDocument();
      expect(
        screen.getByTestId(/span-evidence-key-value-list.repeating-spans/)
      ).toHaveTextContent('/book/');

      expect(screen.queryByRole('cell', {name: 'Parameters'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.parameters')
      ).toHaveTextContent('book_id:{7,8} sort:{up,down}');
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

    builder.addSpan(parentSpan);

    it('Renders relevant fields', () => {
      render(<SpanEvidenceKeyValueList event={builder.getEvent()} />);

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/');

      expect(screen.getByRole('cell', {name: 'Slow DB Query'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.slow-db-query')
      ).toHaveTextContent('SELECT pokemon FROM pokedex');
    });
  });

  describe('Render Blocking Asset', () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET
    );

    const offenderSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 1000,
      op: 'resource.script',
      description: 'https://example.com/resource.js',
      problemSpan: ProblemSpan.OFFENDER,
    });

    builder.addSpan(offenderSpan);

    it('Renders relevant fields', () => {
      render(<SpanEvidenceKeyValueList event={builder.getEvent()} />);

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction')
      ).toHaveTextContent('/');

      expect(screen.getByRole('cell', {name: 'Slow Resource Span'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.slow-resource-span')
      ).toHaveTextContent('resource.script - https://example.com/resource.js');
    });
  });
});
