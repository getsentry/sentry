import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  MockSpan,
  ProblemSpan,
  TransactionEventBuilder,
} from 'sentry-test/performance/utils';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {IssueType} from 'sentry/types/group';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';

describe('spanEvidenceTracePath', () => {
  it('collapses long trace paths', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });

    const builder = new TransactionEventBuilder(
      'a1',
      '/',
      IssueType.PERFORMANCE_SLOW_DB_QUERY
    );

    const rootSpan = new MockSpan({
      startTimestamp: 0,
      endTimestamp: 100,
      op: 'function',
      description: 'LinkCatalog',
    });
    let currentSpan = rootSpan;

    for (let i = 1; i <= 5; i++) {
      currentSpan.addChild({
        startTimestamp: i,
        endTimestamp: 100 + i,
        op: 'function',
        description: `Layer ${i}`,
      });
      currentSpan = currentSpan.children[0]!;
    }

    currentSpan.addChild({
      startTimestamp: 10,
      endTimestamp: 10100,
      op: 'db',
      description: 'SELECT pokemon FROM pokedex',
      problemSpan: ProblemSpan.OFFENDER,
    });

    builder.addSpan(rootSpan);

    render(<SpanEvidenceKeyValueList event={builder.getEventFixture()} />, {
      organization: OrganizationFixture({
        features: ['visibility-explore-view'],
      }),
    });

    const tracePath = screen.getByTestId('span-evidence-key-value-list.trace-path');

    expect(tracePath).toHaveTextContent('… 3 spans hidden');
    expect(tracePath).not.toHaveTextContent('Layer 2');

    await userEvent.click(screen.getByRole('button', {name: 'Show full path'}));

    expect(tracePath).toHaveTextContent('Layer 2');
    expect(tracePath).not.toHaveTextContent('… 3 spans hidden');
  });
});
