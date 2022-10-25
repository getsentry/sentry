import {
  MockSpan,
  ProblemSpan,
  TransactionEventBuilder,
} from 'sentry-test/performance/utils';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as useApi from 'sentry/utils/useApi';

import {SpanEvidencePreview} from './spanEvidencePreview';

describe('SpanEvidencePreview', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.restoreAllMocks();
  });

  it('does not fetch before hover', () => {
    const api = new MockApiClient();
    jest.spyOn(useApi, 'default').mockReturnValue(api);
    const spy = jest.spyOn(api, 'requestPromise');

    render(
      <SpanEvidencePreview
        eventId="event-id"
        projectSlug="project-slug"
        groupId="group-id"
      >
        Hover me
      </SpanEvidencePreview>
    );

    jest.runAllTimers();

    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches from event URL when event and project are provided', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/event-id/`,
      body: null,
    });

    render(
      <SpanEvidencePreview
        eventId="event-id"
        projectSlug="project-slug"
        groupId="group-id"
      >
        Hover me
      </SpanEvidencePreview>
    );

    userEvent.hover(screen.getByText('Hover me'));

    await waitFor(() => {
      expect(mock).toHaveBeenCalled();
    });
  });

  it('fetches from group URL when only group ID is provided', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/issues/group-id/events/latest/`,
      body: null,
    });

    render(<SpanEvidencePreview groupId="group-id">Hover me</SpanEvidencePreview>);

    userEvent.hover(screen.getByText('Hover me'));

    await waitFor(() => {
      expect(mock).toHaveBeenCalled();
    });
  });

  it('shows error when request fails', async () => {
    const api = new MockApiClient();
    jest.spyOn(useApi, 'default').mockReturnValue(api);
    jest.spyOn(api, 'requestPromise').mockRejectedValue(new Error());

    render(<SpanEvidencePreview groupId="group-id">Hover me</SpanEvidencePreview>);

    userEvent.hover(screen.getByText('Hover me'));

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
      .getEvent();

    MockApiClient.addMockResponse({
      url: `/issues/group-id/events/latest/`,
      body: event,
    });

    render(<SpanEvidencePreview groupId="group-id">Hover me</SpanEvidencePreview>);

    userEvent.hover(screen.getByText('Hover me'));

    await screen.findByTestId('span-evidence-preview-body');

    expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: event.title})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: 'Parent Span'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'db - connect'})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: 'Repeating Span'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'db - group me'})).toBeInTheDocument();
  });
});
