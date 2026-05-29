import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  MockSpan,
  ProblemSpan,
  TransactionEventBuilder,
} from 'sentry-test/performance/utils';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {EntrySpans} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {IssueType} from 'sentry/types/group';

import {SpanEvidenceTraceStack} from './spanEvidenceTraceStack';

describe('SpanEvidenceTraceStack', () => {
  it('renders an interactive evidence stack for a slow db query', async () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_SLOW_DB_QUERY
    );
    builder.getEventFixture().projectID = '123';

    const parentSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 0.2,
      op: 'function',
      description: 'LinkCatalog',
      problemSpan: ProblemSpan.PARENT,
    });

    parentSpan.addChild({
      startTimestamp: 0.01,
      endTimestamp: 4,
      op: 'db',
      description: 'SELECT pokemon FROM pokedex',
      problemSpan: ProblemSpan.OFFENDER,
    });

    builder.addSpan(parentSpan);

    const event = builder.getEventFixture();
    const spanEntry = event.entries.find(
      (entry): entry is EntrySpans => entry.type === EntryType.SPANS
    )!;

    render(
      <SpanEvidenceTraceStack
        collapseEvidenceLabel="Hide slow DB query"
        event={event}
        evidenceTitle="Slow DB Query"
        expandEvidenceLabel="Show slow DB query"
        location={LocationFixture()}
        organization={OrganizationFixture()}
        offendingSpans={[spanEntry.data[1]!]}
        projectSlug="project"
        sqlStatements={['SELECT pokemon FROM pokedex']}
      />
    );

    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      'Transaction/'
    );
    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      'FunctionLinkCatalog'
    );
    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      'Slow DB Query'
    );
    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      /SELECT pokemon\s+FROM pokedex/
    );

    await userEvent.click(screen.getByRole('button', {name: 'Hide slow DB query'}));

    expect(screen.getByTestId('span-evidence-trace-stack-example')).not.toHaveTextContent(
      /SELECT pokemon\s+FROM pokedex/
    );

    await userEvent.click(screen.getByRole('button', {name: 'Show slow DB query'}));

    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      /SELECT pokemon\s+FROM pokedex/
    );
  });

  it('renders an interactive evidence stack for repeated db queries', async () => {
    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES
    );
    builder.getEventFixture().projectID = '123';

    const parentSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 0.2,
      op: 'function',
      description: 'LinkCatalogStore',
      problemSpan: ProblemSpan.PARENT,
    });

    parentSpan.addChild({
      startTimestamp: 0.005,
      endTimestamp: 0.01,
      op: 'db',
      description: 'SELECT * FROM authors WHERE id = %s',
      problemSpan: ProblemSpan.CAUSE,
    });
    parentSpan.addChild({
      startTimestamp: 0.01,
      endTimestamp: 2.1,
      op: 'db',
      description: 'SELECT * FROM books',
      hash: 'aaa',
      problemSpan: ProblemSpan.OFFENDER,
    });
    parentSpan.addChild({
      startTimestamp: 2.1,
      endTimestamp: 4,
      op: 'db',
      description: 'SELECT * FROM books',
      hash: 'aaa',
      problemSpan: ProblemSpan.OFFENDER,
    });

    builder.addSpan(parentSpan);

    const event = builder.getEventFixture();
    const spanEntry = event.entries.find(
      (entry): entry is EntrySpans => entry.type === EntryType.SPANS
    )!;

    render(
      <SpanEvidenceTraceStack
        event={event}
        location={LocationFixture()}
        organization={OrganizationFixture()}
        parentSpan={spanEntry.data[0]}
        offendingSpans={[spanEntry.data[2]!, spanEntry.data[3]!]}
        patternSize={2}
        precedingSpan={spanEntry.data[1]}
        projectSlug="project"
      />
    );

    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      'Repeating DB Queries (2)'
    );
    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      'Transaction/'
    );
    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      'FunctionLinkCatalogStore'
    );
    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      'Repeating DB Queries (2)'
    );
    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      'Pattern Size 2'
    );
    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      'Preceding Span'
    );
    expect(screen.queryByText('Operation')).not.toBeInTheDocument();
    expect(
      screen.queryByText('SELECT * FROM authors WHERE id = %s')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: '/'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/summary/?project=123&referrer=performance-transaction-summary&transaction=%2F&unselectedSeries=p100%28%29&unselectedSeries=avg%28%29'
    );
    expect(screen.getByRole('button', {name: 'View Full Trace'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/traces/trace/8cbbc19c0f54447ab702f00263262726/?eventId=a1&statsPeriod=14d&timestamp=4'
    );

    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      /SELECT \*\s+FROM books/
    );

    await userEvent.click(screen.getByRole('button', {name: 'Show preceding span'}));

    expect(screen.queryByText('Operation')).not.toBeInTheDocument();
    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      /SELECT \*\s+FROM authors\s+WHERE id = %s/
    );

    await userEvent.click(screen.getByRole('button', {name: 'Hide repeated queries'}));

    expect(screen.getByTestId('span-evidence-trace-stack-example')).not.toHaveTextContent(
      /SELECT \*\s+FROM books/
    );

    await userEvent.click(screen.getByRole('button', {name: 'Show repeated queries'}));

    expect(screen.getByTestId('span-evidence-trace-stack-example')).toHaveTextContent(
      /SELECT \*\s+FROM books/
    );
  });
});
