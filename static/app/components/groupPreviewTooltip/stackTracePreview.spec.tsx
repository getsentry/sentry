import {EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {EventError, ExceptionType, ExceptionValue, Frame} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';

import {StackTracePreview} from './stackTracePreview';

beforeEach(() => {
  MockApiClient.clearMockResponses();
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/issues/123/',
  });
});

describe('StackTracePreview', () => {
  it('renders error message', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/123/events/recommended/`,
      statusCode: 400,
    });

    render(<StackTracePreview groupId="123">Preview Trigger</StackTracePreview>);

    await userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(await screen.findByText(/Failed to load stack trace/)).toBeInTheDocument();
  });

  it('warns about no stacktrace', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/123/events/recommended/`,
      body: EventFixture({id: '456', entries: []}),
    });

    render(<StackTracePreview groupId="123">Preview Trigger</StackTracePreview>);

    await userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(
      await screen.findByText(/There is no stack trace available for this issue./)
    ).toBeInTheDocument();
  });

  it.each([['stack-trace-content', []]])('renders %s', async (component, features) => {
    const frame: Frame = {
      colNo: 0,
      filename: 'file.js',
      function: 'throwError',
      lineNo: 0,
      absPath: null,
      context: [],
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
      url: `/organizations/org-slug/issues/123/events/recommended/`,
      body: EventFixture(errorEvent),
    });

    render(<StackTracePreview groupId="123">Preview Trigger</StackTracePreview>, {
      organization: {features},
    });

    await userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(await screen.findByTestId(component)).toBeInTheDocument();
    // Hide the platform icon for stack trace previews
    expect(screen.queryAllByRole('img')).toHaveLength(1);
  });
});
