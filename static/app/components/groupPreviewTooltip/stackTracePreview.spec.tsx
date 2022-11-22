import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {EventError} from 'sentry/types';
import {EntryType, Event, ExceptionType, ExceptionValue, Frame} from 'sentry/types/event';

import {StackTracePreview} from './stackTracePreview';

const makeEvent = (event: Partial<Event> = {}): Event => {
  const evt: Event = {
    ...TestStubs.Event(),
    ...event,
  };

  return evt;
};

beforeEach(() => {
  MockApiClient.clearMockResponses();
});

describe('StackTracePreview', () => {
  it('fetches from projects when eventId and projectSlug are provided', async () => {
    const mockGet = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project_slug/events/event_id/`,
      body: makeEvent({id: 'event_id', entries: []}),
    });

    render(
      <StackTracePreview issueId="issue" eventId="event_id" projectSlug="project_slug">
        Preview Trigger
      </StackTracePreview>
    );

    userEvent.hover(screen.getByText(/Preview Trigger/));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });
  });

  it('fetches from issues when issueId when eventId and projectSlug are not provided', async () => {
    const mockGet = MockApiClient.addMockResponse({
      url: `/issues/issue/events/latest/?collapse=stacktraceOnly`,
      body: makeEvent({id: 'event_id', entries: []}),
    });

    render(<StackTracePreview issueId="issue">Preview Trigger</StackTracePreview>);

    userEvent.hover(screen.getByText(/Preview Trigger/));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });
  });

  it('renders error message', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/issue/events/latest/?collapse=stacktraceOnly`,
      statusCode: 400,
    });

    render(<StackTracePreview issueId="issue">Preview Trigger</StackTracePreview>);

    userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(await screen.findByText(/Failed to load stack trace/)).toBeInTheDocument();
  });

  it('warns about no stacktrace', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/issue/events/latest/?collapse=stacktraceOnly`,
      body: makeEvent({id: 'event_id', entries: []}),
    });

    render(<StackTracePreview issueId="issue">Preview Trigger</StackTracePreview>);

    userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(
      await screen.findByText(/There is no stack trace available for this issue./)
    ).toBeInTheDocument();
  });

  it.each([
    ['stack-trace-content', []],
    ['stack-trace-content-v2', ['grouping-stacktrace-ui']],
  ])('renders %s', async (component, features) => {
    const frame: Frame = {
      colNo: 0,
      filename: 'file.js',
      function: 'throwError',
      lineNo: 0,
      absPath: null,
      context: [],
      errors: null,
      inApp: false,
      instructionAddr: null,
      module: null,
      package: null,
      platform: null,
      rawFunction: null,
      symbol: null,
      symbolAddr: null,
      trust: undefined,
      vars: null,
    };
    const thread: ExceptionValue = {
      stacktrace: {
        hasSystemFrames: false,
        registers: {},
        framesOmitted: 0,
        frames: [frame],
      },
      mechanism: null,
      module: null,
      rawStacktrace: null,
      threadId: null,
      type: '',
      value: '',
    };

    const exceptionValue: ExceptionType = {
      values: [thread],
      excOmitted: undefined,
      hasSystemFrames: false,
    };

    const errorEvent: EventError = {
      id: 'event_id',
      entries: [
        {
          type: EntryType.EXCEPTION,
          data: exceptionValue,
        },
      ],
    } as EventError;

    MockApiClient.addMockResponse({
      url: `/issues/issue/events/latest/?collapse=stacktraceOnly`,
      body: makeEvent(errorEvent),
    });

    render(<StackTracePreview issueId="issue">Preview Trigger</StackTracePreview>, {
      organization: {features},
    });

    userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(await screen.findByTestId(component)).toBeInTheDocument();
  });
});
