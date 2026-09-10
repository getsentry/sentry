import {EventFixture} from 'sentry-fixture/event';
import {FrameFixture} from 'sentry-fixture/frame';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {IssueStackTrace} from 'sentry/components/stackTrace/issueStackTrace';
import {SharedIssueStackTrace} from 'sentry/components/stackTrace/issueStackTrace/sharedIssueStackTrace';
import {IssueThreadStackTrace} from 'sentry/components/stackTrace/issueThreadStackTrace';
import type {ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

const storageKey = 'issue-details-stracktrace-display-org-slug-project-slug';
const stacktrace: StacktraceType = {
  framesOmitted: null,
  hasSystemFrames: false,
  registers: null,
  frames: [
    FrameFixture({
      function: 'causeCrash',
      platform: 'cocoa',
      filename: 'App.m',
      absPath: '/src/App.m',
      instructionAddr: '0x100001000',
      package: '/build/App.app/App',
      inApp: true,
      context: [],
    }),
  ],
};
const exception: ExceptionValue = {
  type: 'EXC_BAD_ACCESS',
  value: 'invalid address',
  module: null,
  mechanism: null,
  threadId: null,
  rawStacktrace: null,
  stacktrace,
};
const event = EventFixture({
  platform: 'cocoa',
  entries: [{type: EntryType.EXCEPTION, data: {values: [exception]}}],
});

describe('Stack trace GA entry points', () => {
  beforeEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();
  });

  it('renders a native exception without threads and loads its Apple report in raw view', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: DetailedProjectFixture(),
    });
    const report = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/${event.id}/apple-crash-report`,
      body: 'Native crash report',
    });
    render(
      <IssueStackTrace event={event} values={[exception]} projectSlug="project-slug" />
    );
    expect(await screen.findByText('causeCrash')).toBeInTheDocument();
    expect(screen.getByText('EXC_BAD_ACCESS')).toBeInTheDocument();
    expect(report).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(screen.getByRole('option', {name: 'Raw Stack Trace'}));
    expect(await screen.findByText('Native crash report')).toBeInTheDocument();
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('uses event data for shared native raw traces without requests or persisted preferences', async () => {
    localStorage.setItem(storageKey, JSON.stringify(['raw-stack-trace']));
    const request = jest.spyOn(MockApiClient.prototype, 'request');
    render(<SharedIssueStackTrace event={event} stacktrace={stacktrace} />);
    expect(await screen.findByText('causeCrash')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(screen.getByRole('option', {name: 'Raw Stack Trace'}));
    expect(screen.getByText(/causeCrash/, {selector: 'pre'})).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
  });

  it('renders shared native threads without authenticated requests or download actions', async () => {
    const threads = [
      {
        id: 1,
        name: 'main',
        current: true,
        crashed: true,
        stacktrace,
        rawStacktrace: null,
      },
    ];
    const request = jest.spyOn(MockApiClient.prototype, 'request');
    render(
      <IssueThreadStackTrace
        event={EventFixture({
          platform: 'cocoa',
          entries: [{type: EntryType.THREADS, data: {values: threads}}],
        })}
        data={{values: threads}}
        isShared
        group={undefined}
        groupingCurrentLevel={undefined}
        projectSlug="project-slug"
      />
    );
    expect(await screen.findByText('causeCrash')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /download/i})).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
  });

  it('persists display changes for non-native threads', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: DetailedProjectFixture(),
    });
    const trace = {
      ...stacktrace,
      frames: [
        FrameFixture({
          platform: 'javascript',
          function: 'handle',
          inApp: true,
          context: [],
        }),
      ],
    };
    const threads = [
      {id: 1, current: true, crashed: true, stacktrace: trace, rawStacktrace: trace},
    ];
    render(
      <IssueThreadStackTrace
        event={EventFixture({
          platform: 'javascript',
          entries: [{type: EntryType.THREADS, data: {values: threads}}],
        })}
        data={{values: threads}}
        group={undefined}
        groupingCurrentLevel={undefined}
        projectSlug="project-slug"
      />
    );
    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(screen.getByRole('option', {name: 'Minified'}));
    await userEvent.click(screen.getByRole('option', {name: 'Raw Stack Trace'}));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(
        expect.arrayContaining(['minified', 'raw-stack-trace'])
      )
    );
  });
});
