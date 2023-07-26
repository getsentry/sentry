import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
  MockApiClient.addMockResponse({
    url: '/issues/123/',
  });
});

describe('StackTracePreview', () => {
  it('renders error message', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/123/events/latest/`,
      statusCode: 400,
    });

    render(<StackTracePreview groupId="123">Preview Trigger</StackTracePreview>);

    await userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(await screen.findByText(/Failed to load stack trace/)).toBeInTheDocument();
  });

  it('warns about no stacktrace', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/123/events/latest/`,
      body: makeEvent({id: '456', entries: []}),
    });

    render(<StackTracePreview groupId="123">Preview Trigger</StackTracePreview>);

    await userEvent.hover(screen.getByText(/Preview Trigger/));

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
      id: '456',
      entries: [
        {
          type: EntryType.EXCEPTION,
          data: exceptionValue,
        },
      ],
    } as EventError;

    MockApiClient.addMockResponse({
      url: `/issues/123/events/latest/`,
      body: makeEvent(errorEvent),
    });

    render(<StackTracePreview groupId="123">Preview Trigger</StackTracePreview>, {
      organization: {features},
    });

    await userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(await screen.findByTestId(component)).toBeInTheDocument();
  });
});
