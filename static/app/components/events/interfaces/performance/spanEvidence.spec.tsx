import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {
  EXAMPLE_TRANSACTION_TITLE,
  ProblemSpan,
  TransactionEventBuilder,
} from 'sentry-test/performance/utils';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventTransaction} from 'sentry/types';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

import {SpanEvidenceSection} from './spanEvidence';

const {organization, router} = initializeData({
  features: ['performance-issues'],
});

const WrappedComponent = ({event}: {event: EventTransaction}) => (
  <OrganizationContext.Provider value={organization}>
    <RouteContext.Provider
      value={{
        router,
        location: router.location,
        params: {},
        routes: [],
      }}
    >
      <SpanEvidenceSection organization={organization} event={event} />
    </RouteContext.Provider>
  </OrganizationContext.Provider>
);

describe('spanEvidence', () => {
  it('renders and highlights the correct data in the span evidence section', () => {
    const builder = new TransactionEventBuilder();

    builder.addSpan({
      startTimestamp: 0,
      endTimestamp: 100,
      op: 'http',
      description: 'do a thing',
    });

    builder.addSpan({
      startTimestamp: 100,
      endTimestamp: 200,
      op: 'db',
      description: 'SELECT col FROM table',
    });

    builder.addSpan({
      startTimestamp: 200,
      endTimestamp: 300,
      op: 'db',
      description: 'SELECT col2 FROM table',
    });

    builder.addSpan({
      startTimestamp: 200,
      endTimestamp: 300,
      op: 'db',
      description: 'SELECT col3 FROM table',
    });

    builder.addSpan({
      startTimestamp: 200,
      endTimestamp: 300,
      op: 'db',
      description: 'connect',
      problemSpan: ProblemSpan.PARENT,
      childOpts: [
        {
          startTimestamp: 300,
          endTimestamp: 600,
          op: 'db',
          description: 'group me',
          numSpans: 9,
          problemSpan: ProblemSpan.OFFENDER,
        },
      ],
    });

    render(<WrappedComponent event={builder.getEvent()} />);

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
