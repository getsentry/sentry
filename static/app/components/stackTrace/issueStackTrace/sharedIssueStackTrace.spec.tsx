import {EventFixture} from 'sentry-fixture/event';
import {EventEntryChainedExceptionFixture} from 'sentry-fixture/eventEntryChainedException';
import {EventEntryStacktraceFixture} from 'sentry-fixture/eventEntryStacktrace';
import {FrameFixture} from 'sentry-fixture/frame';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SharedIssueStackTrace} from 'sentry/components/stackTrace/issueStackTrace/sharedIssueStackTrace';

describe('SharedIssueStackTrace', () => {
  const entry = EventEntryStacktraceFixture();
  const event = EventFixture({entries: [entry]});

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('keeps shared native display choices local and formats raw frames without requests', async () => {
    const storageKey = 'issue-details-stracktrace-display-org-slug-project-slug';
    const savedOptions = JSON.stringify(['raw-stack-trace']);
    localStorage.setItem(storageKey, savedOptions);
    const stacktrace = {
      ...entry.data,
      frames: [
        FrameFixture({
          platform: 'cocoa',
          function: 'causeCrash',
          rawFunction: null,
          module: null,
        }),
      ],
    };
    const nativeEvent = EventFixture({
      platform: 'cocoa',
      entries: [{type: 'stacktrace', data: stacktrace}],
    });
    const request = jest.spyOn(MockApiClient.prototype, 'request');
    const {unmount} = render(
      <SharedIssueStackTrace event={nativeEvent} stacktrace={stacktrace} />
    );

    expect(await screen.findByText('causeCrash')).toBeInTheDocument();
    expect(screen.queryByText(/causeCrash/, {selector: 'pre'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(screen.getByRole('option', {name: 'Raw Stack Trace'}));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText(/causeCrash/, {selector: 'pre'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(screen.getByRole('option', {name: 'Full Stack Trace'}));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText(/causeCrash/, {selector: 'pre'})).not.toBeInTheDocument();
    expect(localStorage.getItem(storageKey)).toBe(savedOptions);

    unmount();
    render(<SharedIssueStackTrace event={nativeEvent} stacktrace={stacktrace} />);
    expect(await screen.findByText('causeCrash')).toBeInTheDocument();
    expect(screen.queryByText(/causeCrash/, {selector: 'pre'})).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('renders a single exception', async () => {
    render(
      <SharedIssueStackTrace
        event={event}
        values={[
          {
            type: 'ValueError',
            value: 'list index out of range',
            module: 'raven.base',
            mechanism: {handled: false, type: 'generic'},
            stacktrace: entry.data,
            threadId: null,
            rawStacktrace: null,
          },
        ]}
      />
    );

    expect(await screen.findByText('ValueError')).toBeInTheDocument();
    expect(screen.getByText('list index out of range')).toBeInTheDocument();
    expect(screen.getAllByTestId('core-stacktrace-frame-row').length).toBeGreaterThan(0);
  });

  it('renders chained exceptions with expandable frame lists', async () => {
    const chained = EventEntryChainedExceptionFixture();
    render(
      <SharedIssueStackTrace
        event={EventFixture({platform: 'python', entries: [chained]})}
        values={chained.data.values ?? []}
      />
    );
    expect(
      await screen.findByText(/chained exceptions in this event/)
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('core-stacktrace-frame-row').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ValueError').length).toBeGreaterThan(0);
  });

  it('renders a standalone stacktrace', async () => {
    render(<SharedIssueStackTrace event={event} stacktrace={entry.data} />);

    expect(await screen.findByText('Stack Trace')).toBeInTheDocument();
    expect(screen.getAllByTestId('core-stacktrace-frame-row').length).toBeGreaterThan(0);
  });
});
