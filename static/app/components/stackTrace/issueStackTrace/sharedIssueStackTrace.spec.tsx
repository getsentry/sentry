import {EventFixture} from 'sentry-fixture/event';
import {EventEntryChainedExceptionFixture} from 'sentry-fixture/eventEntryChainedException';
import {EventEntryStacktraceFixture} from 'sentry-fixture/eventEntryStacktrace';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SharedIssueStackTrace} from 'sentry/components/stackTrace/issueStackTrace/sharedIssueStackTrace';

describe('SharedIssueStackTrace', () => {
  const entry = EventEntryStacktraceFixture();
  const event = EventFixture({entries: [entry]});

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
