import {EventFixture} from 'sentry-fixture/event';
import {EventStacktraceFrameFixture} from 'sentry-fixture/eventStacktraceFrame';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {EventError, ExceptionType, ExceptionValue, Frame} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

import {StackTracePreview, StackTracePreviewContent} from './stackTracePreview';

function makeNativePreview() {
  const stacktrace: StacktraceType = {
    frames: [
      EventStacktraceFrameFixture({
        filename: 'ViewController.m',
        function: 'ViewController.causeCrash',
        inApp: true,
        instructionAddr: '0x100001000',
        package: '/build/CrashyApp.app/CrashyApp',
        platform: 'cocoa',
      }),
    ],
    framesOmitted: null,
    hasSystemFrames: false,
    registers: null,
  };

  return {
    event: EventFixture({platform: 'cocoa'}),
    stacktrace,
  };
}

beforeEach(() => {
  MockApiClient.clearMockResponses();
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/issues/123/',
  });
});

describe('StackTracePreview', () => {
  it('renders error message', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/123/events/recommended/',
      statusCode: 400,
    });

    render(<StackTracePreview groupId="123">Preview Trigger</StackTracePreview>);

    await userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(await screen.findByText(/Failed to load stack trace/)).toBeInTheDocument();
  });

  it('warns about no stacktrace', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/123/events/recommended/',
      body: EventFixture({id: '456', entries: []}),
    });

    render(<StackTracePreview groupId="123">Preview Trigger</StackTracePreview>);

    await userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(
      await screen.findByText(/There is no stack trace available for this issue./)
    ).toBeInTheDocument();
  });

  it('renders stack trace frames', async () => {
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
        framesOmitted: null,
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

    const errorEvent = {
      id: '456',
      entries: [
        {
          type: EntryType.EXCEPTION,
          data: exceptionValue,
        },
      ],
    } as EventError;

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/123/events/recommended/',
      body: EventFixture(errorEvent),
    });

    render(<StackTracePreview groupId="123">Preview Trigger</StackTracePreview>);

    await userEvent.hover(screen.getByText(/Preview Trigger/));

    expect(await screen.findByTestId('core-stacktrace-frame-row')).toBeInTheDocument();
    // Hide the platform icon for stack trace previews
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('renders legacy native stack trace previews without the feature flag', () => {
    const {event, stacktrace} = makeNativePreview();

    render(<StackTracePreviewContent event={event} stacktrace={stacktrace} />);

    expect(screen.getByTestId('stack-trace-frame')).toBeInTheDocument();
    expect(
      screen.queryByTestId('native-stack-trace-frame-title')
    ).not.toBeInTheDocument();
  });

  it('renders new native stack trace previews with the feature flag', () => {
    const {event, stacktrace} = makeNativePreview();

    render(<StackTracePreviewContent event={event} stacktrace={stacktrace} />, {
      organization: OrganizationFixture({
        features: ['issue-details-new-stack-trace'],
      }),
    });

    expect(screen.getByTestId('native-stack-trace-frame-title')).toBeInTheDocument();
    expect(screen.queryByTestId('stack-trace-frame')).not.toBeInTheDocument();
  });
});
