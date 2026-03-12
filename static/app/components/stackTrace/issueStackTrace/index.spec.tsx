import {EventFixture} from 'sentry-fixture/event';
import {EventEntryStacktraceFixture} from 'sentry-fixture/eventEntryStacktrace';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {IssueStackTrace} from 'sentry/components/stackTrace/issueStackTrace';
import ProjectsStore from 'sentry/stores/projectsStore';
import {CodecovStatusCode, Coverage} from 'sentry/types/integrations';
import type {StacktraceType} from 'sentry/types/stacktrace';

type StacktraceWithFrames = StacktraceType & {
  frames: NonNullable<StacktraceType['frames']>;
};

function makeStackTraceData(): {
  event: ReturnType<typeof EventFixture>;
  stacktrace: StacktraceWithFrames;
} {
  const entry = EventEntryStacktraceFixture();

  return {
    event: EventFixture({
      platform: 'python',
      projectID: '1',
      entries: [entry],
    }),
    stacktrace: {
      ...entry.data,
      hasSystemFrames: true,
      frames:
        entry.data.frames?.map((frame, index) => ({
          ...frame,
          inApp: index >= 2,
        })) ?? [],
    } as StacktraceWithFrames,
  };
}

describe('IssueStackTrace', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {dismissed_ts: undefined, snoozed_ts: undefined},
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/stacktrace-link/',
      body: {config: null, sourceUrl: null, integrations: []},
    });
  });

  it('does not render when event has threads', () => {
    const {event, stacktrace} = makeStackTraceData();
    const eventWithThreads = EventFixture({
      ...event,
      entries: [
        ...event.entries,
        {type: 'threads' as const, data: {values: [{id: 0, current: true}]}},
      ],
    });

    const {container} = render(
      <IssueStackTrace
        event={eventWithThreads}
        values={[
          {
            type: 'ValueError',
            value: 'list index out of range',
            module: 'raven.base',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            threadId: null,
            rawStacktrace: null,
          },
        ]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shares display options across chained issue exceptions', async () => {
    const {event, stacktrace} = makeStackTraceData();
    render(
      <IssueStackTrace
        event={event}
        values={[
          {
            type: 'RootError',
            value: 'root cause',
            module: 'raven.base',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            threadId: null,
            rawStacktrace: null,
          },
          {
            type: 'NestedError',
            value: 'nested cause',
            module: 'raven.scripts.runner',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            threadId: null,
            rawStacktrace: null,
          },
        ]}
      />
    );

    expect(screen.getAllByTestId('core-stacktrace-frame-row')).toHaveLength(8);

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Full Stack Trace'}));

    expect(await screen.findAllByTestId('core-stacktrace-frame-row')).toHaveLength(10);
  });

  it('renders chained exceptions in newest-first order by default and reverses on sort toggle', async () => {
    const {event, stacktrace} = makeStackTraceData();
    render(
      <IssueStackTrace
        event={event}
        values={[
          {
            type: 'RootError',
            value: 'root cause',
            module: 'raven.base',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            threadId: null,
            rawStacktrace: null,
          },
          {
            type: 'MiddleError',
            value: 'middle cause',
            module: 'raven.scripts.runner',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            threadId: null,
            rawStacktrace: null,
          },
          {
            type: 'LeafError',
            value: 'leaf cause',
            module: 'raven.scripts.runner',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            threadId: null,
            rawStacktrace: null,
          },
        ]}
      />
    );

    const headings = screen.getAllByRole('heading', {level: 5});
    expect(headings[0]).toHaveTextContent('LeafError');
    expect(headings[1]).toHaveTextContent('MiddleError');
    expect(headings[2]).toHaveTextContent('RootError');

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Oldest'}));

    const reorderedHeadings = screen.getAllByRole('heading', {level: 5});
    expect(reorderedHeadings[0]).toHaveTextContent('RootError');
    expect(reorderedHeadings[1]).toHaveTextContent('MiddleError');
    expect(reorderedHeadings[2]).toHaveTextContent('LeafError');
  });

  it('renders coverage tooltip from issue-level coverage request', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const organization = OrganizationFixture({slug: 'org-slug', codecovAccess: true});
    const project = ProjectFixture({
      id: event.projectID,
      slug: 'project-slug',
    });
    ProjectsStore.loadInitialData([project]);
    const coverageRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-coverage/`,
      body: {
        status: CodecovStatusCode.COVERAGE_EXISTS,
        lineCoverage: [
          [110, Coverage.COVERED],
          [111, Coverage.PARTIAL],
          [112, Coverage.NOT_COVERED],
        ],
      },
    });

    render(
      <IssueStackTrace
        event={event}
        values={[
          {
            type: 'ValueError',
            value: 'list index out of range',
            module: 'raven.base',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            threadId: null,
            rawStacktrace: null,
          },
        ]}
      />,
      {organization}
    );

    expect(
      await screen.findByTestId('core-stacktrace-frame-context')
    ).toBeInTheDocument();
    expect(coverageRequest).toHaveBeenCalled();

    await userEvent.hover(screen.getByLabelText('Line 112'));

    expect(await screen.findByText('Line uncovered by tests')).toBeInTheDocument();
  });

  it('renders annotated text when exception value has PII scrubbing metadata', async () => {
    const {stacktrace} = makeStackTraceData();
    const entryIndex = 0;
    const event = EventFixture({
      platform: 'python',
      projectID: '1',
      entries: [{type: 'exception' as const, data: {values: []}}],
      _meta: {
        entries: {
          [entryIndex]: {
            data: {
              values: {
                0: {
                  value: {
                    '': {
                      rem: [['project:0', 's', 0, 0]],
                      len: 18,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    render(
      <IssueStackTrace
        event={event}
        values={[
          {
            type: 'ValueError',
            value: null,
            module: null,
            mechanism: null,
            stacktrace,
            rawStacktrace: null,
            threadId: null,
          },
        ]}
      />
    );

    expect(await screen.findByText('<redacted>')).toBeInTheDocument();
  });

  it('shows raw exception type/value/module when minified toggle is active', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const rawStacktrace: StacktraceWithFrames = {
      ...stacktrace,
      frames: stacktrace.frames.map(f => ({
        ...f,
        function: f.function ? `_min_${f.function}` : f.function,
      })),
    };

    render(
      <IssueStackTrace
        event={event}
        values={[
          {
            type: 'ValueError',
            value: 'symbolicated value',
            module: 'app.main',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            rawStacktrace,
            rawType: 'RawError',
            rawValue: 'raw value',
            rawModule: 'raw.module',
            threadId: null,
          },
        ]}
      />
    );

    expect(await screen.findByText('ValueError')).toBeInTheDocument();
    expect(screen.getByText('symbolicated value')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Unsymbolicated'}));

    expect(await screen.findByText('RawError')).toBeInTheDocument();
    expect(screen.getByText('raw value')).toBeInTheDocument();
  });

  it('falls back to symbolicated values when raw fields are missing', async () => {
    const {event, stacktrace} = makeStackTraceData();
    render(
      <IssueStackTrace
        event={event}
        values={[
          {
            type: 'ValueError',
            value: 'original value',
            module: 'app.main',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            rawStacktrace: stacktrace,
            threadId: null,
          },
        ]}
      />
    );

    expect(await screen.findByText('ValueError')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Unsymbolicated'}));

    expect(await screen.findByText('ValueError')).toBeInTheDocument();
    expect(screen.getByText('original value')).toBeInTheDocument();
  });

  it('renders raw view as flat text for chained exceptions', async () => {
    const {event, stacktrace} = makeStackTraceData();
    render(
      <IssueStackTrace
        event={event}
        values={[
          {
            type: 'RootError',
            value: 'root cause',
            module: 'app.main',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            rawStacktrace: null,
            threadId: null,
          },
          {
            type: 'NestedError',
            value: 'nested cause',
            module: 'app.nested',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            rawStacktrace: null,
            threadId: null,
          },
        ]}
      />
    );

    expect(await screen.findByText('RootError')).toBeInTheDocument();
    expect(screen.getByText('NestedError')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Raw Stack Trace'}));

    expect(screen.queryByText(/chained exception/)).not.toBeInTheDocument();
    expect(screen.getByText(/RootError: root cause/)).toBeInTheDocument();
    expect(screen.getByText(/NestedError: nested cause/)).toBeInTheDocument();
  });

  it('does not reverse exception order in raw view', async () => {
    const {event, stacktrace} = makeStackTraceData();
    render(
      <IssueStackTrace
        event={event}
        values={[
          {
            type: 'FirstError',
            value: 'first',
            module: null,
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            rawStacktrace: null,
            threadId: null,
          },
          {
            type: 'SecondError',
            value: 'second',
            module: null,
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            rawStacktrace: null,
            threadId: null,
          },
        ]}
      />
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Raw Stack Trace'}));

    const rawText = await screen.findByText(/FirstError: first/);
    const pre = rawText.closest('pre')!;
    const firstIdx = pre.textContent.indexOf('FirstError: first');
    const secondIdx = pre.textContent.indexOf('SecondError: second');
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  describe('standalone stacktrace prop', () => {
    it('renders frame rows for a standalone stacktrace', async () => {
      const {event, stacktrace} = makeStackTraceData();

      render(
        <IssueStackTrace
          event={event}
          stacktrace={stacktrace}
          projectSlug="project-slug"
        />
      );

      expect(screen.getByText('Stack Trace')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getAllByTestId('core-stacktrace-frame-row').length).toBeGreaterThan(
          0
        );
      });
    });

    it('returns null when stacktrace has no frames', () => {
      const {event} = makeStackTraceData();
      const emptyStacktrace: StacktraceType = {
        frames: [],
        framesOmitted: null,
        hasSystemFrames: false,
        registers: null,
      };

      const {container} = render(
        <IssueStackTrace
          event={event}
          stacktrace={emptyStacktrace}
          projectSlug="project-slug"
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('exception groups', () => {
    function makeExceptionGroupValues(): {
      event: ReturnType<typeof EventFixture>;
      values: Extract<Parameters<typeof IssueStackTrace>[0], {values: unknown}>['values'];
    } {
      const {stacktrace, event} = makeStackTraceData();
      const minimalStacktrace: StacktraceWithFrames = {
        ...stacktrace,
        frames: [stacktrace.frames[stacktrace.frames.length - 1]!],
      };

      return {
        event,
        values: [
          {
            type: 'ExceptionGroup',
            value: 'root group',
            module: null,
            mechanism: {
              handled: true,
              type: 'chained',
              exception_id: 0,
              is_exception_group: true,
            },
            stacktrace: minimalStacktrace,
            threadId: null,
            rawStacktrace: null,
          },
          {
            type: 'ValueError',
            value: 'value error',
            module: null,
            mechanism: {
              handled: true,
              type: 'chained',
              exception_id: 1,
              parent_id: 0,
            },
            stacktrace: minimalStacktrace,
            threadId: null,
            rawStacktrace: null,
          },
          {
            type: 'NestedGroup',
            value: 'nested group',
            module: null,
            mechanism: {
              handled: true,
              type: 'chained',
              exception_id: 2,
              parent_id: 0,
              is_exception_group: true,
            },
            stacktrace: minimalStacktrace,
            threadId: null,
            rawStacktrace: null,
          },
          {
            type: 'TypeError',
            value: 'type error',
            module: null,
            mechanism: {
              handled: true,
              type: 'chained',
              exception_id: 3,
              parent_id: 2,
            },
            stacktrace: minimalStacktrace,
            threadId: null,
            rawStacktrace: null,
          },
          {
            type: 'KeyError',
            value: 'key error',
            module: null,
            mechanism: {
              handled: true,
              type: 'chained',
              exception_id: 4,
              parent_id: 2,
            },
            stacktrace: minimalStacktrace,
            threadId: null,
            rawStacktrace: null,
          },
        ],
      };
    }

    it('hides children of non-root exception groups by default', async () => {
      const {event, values} = makeExceptionGroupValues();
      render(<IssueStackTrace event={event} values={values} />);

      expect(await screen.findByText('ExceptionGroup')).toBeInTheDocument();
      expect(screen.getByText('ValueError')).toBeInTheDocument();
      expect(screen.getByText('NestedGroup')).toBeInTheDocument();

      expect(screen.queryByText('TypeError')).not.toBeInTheDocument();
      expect(screen.queryByText('KeyError')).not.toBeInTheDocument();
    });

    it('toggles hidden exception group children on button click', async () => {
      const {event, values} = makeExceptionGroupValues();
      render(<IssueStackTrace event={event} values={values} />);

      expect(await screen.findByText('ExceptionGroup')).toBeInTheDocument();
      expect(screen.queryByText('TypeError')).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: 'Show 2 related exceptions'})
      );

      expect(screen.getByText('TypeError')).toBeInTheDocument();
      expect(screen.getByText('KeyError')).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: 'Hide 2 related exceptions'})
      );

      expect(screen.queryByText('TypeError')).not.toBeInTheDocument();
      expect(screen.queryByText('KeyError')).not.toBeInTheDocument();
    });

    it('renders related exceptions tree for exception groups', async () => {
      const {event, values} = makeExceptionGroupValues();
      render(<IssueStackTrace event={event} values={values} />);

      expect(await screen.findByText('ExceptionGroup')).toBeInTheDocument();
      expect(screen.getAllByTestId('related-exceptions-tree')).toHaveLength(2);
    });
  });
});
