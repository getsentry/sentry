import {
  MockSpan,
  ProblemSpan,
  TransactionEventBuilder,
} from 'sentry-test/performance/utils';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SpanEvidencePreview} from './spanEvidencePreview';

describe('SpanEvidencePreview', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/',
    });
  });

  it('does not fetch before hover', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/group-id/events/recommended/`,
      body: {},
    });

    render(<SpanEvidencePreview groupId="group-id">Hover me</SpanEvidencePreview>);

    await act(tick);

    expect(mock).not.toHaveBeenCalled();
  });

  it('shows error when request fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/group-id/events/recommended/`,
      body: {},
      statusCode: 500,
    });

    render(<SpanEvidencePreview groupId="group-id">Hover me</SpanEvidencePreview>);

    await userEvent.hover(screen.getByText('Hover me'), {delay: null});

    await screen.findByText('Failed to load preview');
  });

  it('renders the span evidence correctly when request succeeds', async () => {
    const event = new TransactionEventBuilder()
      .addSpan(
        new MockSpan({
          startTimestamp: 0,
          endTimestamp: 100,
          op: 'http',
          description: 'do a thing',
        })
      )
      .addSpan(
        new MockSpan({
          startTimestamp: 100,
          endTimestamp: 200,
          op: 'db',
          description: 'SELECT col FROM table',
        })
      )
      .addSpan(
        new MockSpan({
          startTimestamp: 200,
          endTimestamp: 300,
          op: 'db',
          description: 'SELECT col2 FROM table',
        })
      )
      .addSpan(
        new MockSpan({
          startTimestamp: 200,
          endTimestamp: 300,
          op: 'db',
          description: 'SELECT col3 FROM table',
        })
      )
      .addSpan(
        new MockSpan({
          startTimestamp: 300,
          endTimestamp: 600,
          op: 'db',
          description: 'connect',
          problemSpan: ProblemSpan.PARENT,
        }).addChild(
          {
            startTimestamp: 300,
            endTimestamp: 600,
            op: 'db',
            description: 'group me',
            problemSpan: ProblemSpan.OFFENDER,
          },
          9
        )
      )
      .getEventFixture();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/group-id/events/recommended/`,
      body: event,
    });

    render(<SpanEvidencePreview groupId="group-id">Hover me</SpanEvidencePreview>);

    await userEvent.hover(screen.getByText('Hover me'), {delay: null});

    await screen.findByTestId('span-evidence-preview-body');

    expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: event.title})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: 'Parent Span'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'connect'})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: 'Repeating Spans (9)'})).toBeInTheDocument();

    // SQLish formatter uppercases group
    expect(screen.getByRole('cell', {name: 'GROUP me'})).toBeInTheDocument();
  });
});
