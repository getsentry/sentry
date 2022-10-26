import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {
  EXAMPLE_TRANSACTION_TITLE,
  MockSpan,
  ProblemSpan,
  TransactionEventBuilder,
} from 'sentry-test/performance/utils';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SpanEvidenceSection} from './spanEvidence';

const {organization} = initializeData({
  features: ['performance-issues'],
});

describe('spanEvidence', () => {
  it('renders and highlights the correct data in the span evidence section', () => {
    const builder = new TransactionEventBuilder();
    builder.addSpan(
      new MockSpan({
        startTimestamp: 0,
        endTimestamp: 100,
        op: 'http',
        description: 'do a thing',
      })
    );

    builder.addSpan(
      new MockSpan({
        startTimestamp: 100,
        endTimestamp: 200,
        op: 'db',
        description: 'SELECT col FROM table',
      })
    );

    builder.addSpan(
      new MockSpan({
        startTimestamp: 200,
        endTimestamp: 300,
        op: 'db',
        description: 'SELECT col2 FROM table',
      })
    );

    builder.addSpan(
      new MockSpan({
        startTimestamp: 200,
        endTimestamp: 300,
        op: 'db',
        description: 'SELECT col3 FROM table',
      })
    );

    const parentProblemSpan = new MockSpan({
      startTimestamp: 300,
      endTimestamp: 600,
      op: 'db',
      description: 'connect',
      problemSpan: ProblemSpan.PARENT,
    });
    parentProblemSpan.addChild(
      {
        startTimestamp: 300,
        endTimestamp: 600,
        op: 'db',
        description: 'group me',
        problemSpan: ProblemSpan.OFFENDER,
      },
      9
    );

    builder.addSpan(parentProblemSpan);

    render(
      <SpanEvidenceSection event={builder.getEvent()} organization={organization} />,
      {organization}
    );

    // Verify the surfaced fields in the span evidence section are correct
    const transactionKey = screen.getByRole('cell', {name: 'Transaction'});
    const transactionVal = screen.getByRole('cell', {name: EXAMPLE_TRANSACTION_TITLE});
    expect(transactionKey).toBeInTheDocument();
    expect(transactionVal).toBeInTheDocument();

    const parentKey = screen.getByRole('cell', {name: 'Parent Span'});
    const parentVal = screen.getByRole('cell', {name: 'db - connect'});
    expect(parentKey).toBeInTheDocument();
    expect(parentVal).toBeInTheDocument();

    const repeatingKey = screen.getByRole('cell', {name: 'Repeating Span'});
    const repeatingVal = screen.getByRole('cell', {name: 'db - group me'});
    expect(repeatingKey).toBeInTheDocument();
    expect(repeatingVal).toBeInTheDocument();

    // Verify that the correct spans are hi-lighted on the span tree as affected spans
    const affectedSpan = screen.getByTestId('row-title-content-affected');
    expect(affectedSpan).toBeInTheDocument();
    expect(affectedSpan).toHaveTextContent('db — connect');
  });
});
