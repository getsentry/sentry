import {EXAMPLE_TRANSACTION_TITLE, MockSpan} from 'sentry-test/performance/utils';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueType} from 'sentry/types';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';

describe('SpanEvidenceKeyValueList', () => {
  describe('N+1 Database Queries', () => {
    it('Renders relevant fields', () => {
      render(
        <SpanEvidenceKeyValueList
          issueType={IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES}
          transactionName={EXAMPLE_TRANSACTION_TITLE}
          parentSpan={
            new MockSpan({
              startTimestamp: 0,
              endTimestamp: 200,
              op: 'http.server',
            }).span
          }
          offendingSpans={[
            new MockSpan({
              startTimestamp: 10,
              endTimestamp: 2100,
              op: 'db',
              description: 'SELECT * FROM books',
            }).span,
            new MockSpan({
              startTimestamp: 10,
              endTimestamp: 2100,
              op: 'db',
              description: 'SELECT * FROM books WHERE id = %s',
            }).span,
          ]}
        />
      );

      expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.transaction-name')
      ).toHaveTextContent('/');

      expect(screen.getByRole('cell', {name: 'Parent Span'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.parent-name')
      ).toHaveTextContent('http.server');

      expect(screen.getByRole('cell', {name: 'Repeating Span'})).toBeInTheDocument();
      expect(
        screen.getByTestId('span-evidence-key-value-list.offending-spans')
      ).toHaveTextContent('db - SELECT * FROM books');

      expect(
        screen.queryByRole('cell', {name: 'Problem Parameter'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('span-evidence-key-value-list.problem-parameters')
      ).not.toBeInTheDocument();
    });
  });
});
