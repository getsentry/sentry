import {EventFixture} from 'sentry-fixture/event';
import {ExceptionValueFixture} from 'sentry-fixture/exceptionValue';
import {FrameFixture} from 'sentry-fixture/frame';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {RawContent} from 'sentry/components/events/interfaces/crashContent/exception/rawContent';
import {StacktraceContext} from 'sentry/components/events/interfaces/stackTraceContext';
import {TraceEventDataSection} from 'sentry/components/events/traceEventDataSection';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {localStorageWrapper} from 'sentry/utils/localStorage';

const project = ProjectFixture();

function CopySection({event, activeThreadId}: {event: Event; activeThreadId?: number}) {
  return (
    <StacktraceContext projectSlug={project.slug} hasSystemFrames>
      <TraceEventDataSection
        type="exception"
        title="Stack Trace"
        event={event}
        eventId={event.id}
        projectSlug={project.slug}
        platform={event.platform ?? 'python'}
        stackTraceNotFound={false}
        hasNewestFirst={false}
        hasMinified
        hasVerboseFunctionNames={false}
        hasAbsoluteFilePaths={false}
        hasAbsoluteAddresses={false}
        activeThreadId={activeThreadId}
      >
        Formatted stack trace
      </TraceEventDataSection>
    </StacktraceContext>
  );
}

describe('TraceEventDataSection copying', () => {
  beforeEach(() => {
    Object.assign(navigator, {clipboard: {writeText: jest.fn().mockResolvedValue('')}});
    const organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    localStorageWrapper.removeItem(
      `issue-details-stracktrace-display-${organization.slug}-${project.slug}`
    );
  });

  it.each<PlatformKey>(['python', 'java'])(
    'copies exactly the raw view for %s',
    async platform => {
      const exception = ExceptionValueFixture({
        type: 'ExampleError',
        value: 'Example failure',
        module: 'example.app',
        stacktrace: {
          frames: [
            FrameFixture({
              platform,
              filename: platform === 'python' ? 'example.py' : 'Example.java',
              module: 'example.app.Example',
              function: 'run',
              lineNo: 42,
            }),
          ],
          framesOmitted: null,
          registers: {},
          hasSystemFrames: false,
        },
      });
      const event = EventFixture({
        platform,
        entries: [
          {
            type: EntryType.EXCEPTION,
            data: {values: [exception], hasSystemFrames: false},
          },
        ],
      });
      const {rerender} = render(<CopySection event={event} />);
      await userEvent.click(screen.getByRole('button', {name: 'Copy as'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Text'}));
      expect(screen.getByText('Formatted stack trace')).toBeInTheDocument();
      const expected =
        platform === 'python'
          ? 'Traceback (most recent call last):\n  File "example.py", line 42, in run\nExampleError: Example failure'
          : 'example.app.ExampleError: Example failure\n    at example.app.Example.run(Example.java:42)';
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expected);
      rerender(
        <RawContent
          eventId={event.id}
          projectSlug="project-slug"
          platform={platform}
          values={[exception]}
          type="original"
          threadId={undefined}
        />
      );
      expect(screen.getByTestId('raw-stack-trace')).toHaveTextContent(expected, {
        normalizeWhitespace: false,
      });
    }
  );

  it('copies exception text when there are no frames', async () => {
    const event = EventFixture({
      platform: 'java',
      entries: [
        {
          type: EntryType.EXCEPTION,
          data: {
            values: [
              ExceptionValueFixture({type: 'ExampleError', value: 'Example failure'}),
            ],
          },
        },
      ],
    });
    render(<CopySection event={event} />);
    await userEvent.click(screen.getByRole('button', {name: 'Copy as'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Text'}));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'ExampleError: Example failure'
    );
  });

  it("copies the selected thread without another thread's exception", async () => {
    const event = EventFixture({
      platform: 'java',
      entries: [
        {
          type: EntryType.EXCEPTION,
          data: {
            values: [ExceptionValueFixture({threadId: 1, type: 'OtherThreadError'})],
          },
        },
        {
          type: EntryType.THREADS,
          data: {
            values: [1, 2].map(id => ({
              id,
              name: `worker-${id}`,
              stacktrace: {
                frames: [
                  FrameFixture({
                    platform: 'java',
                    module: 'example.Worker',
                    function: `run${id}`,
                    filename: 'Worker.java',
                    lineNo: id,
                  }),
                ],
                framesOmitted: null,
                registers: {},
                hasSystemFrames: false,
              },
            })),
          },
        },
      ],
    });
    render(<CopySection event={event} activeThreadId={2} />);
    await userEvent.click(screen.getByRole('button', {name: 'Copy as'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Text'}));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Thread: worker-2\n    at example.Worker.run2(Worker.java:2)'
    );
  });

  it.each([false, true])(
    'copies a threaded exception once with its own stacktrace: %s',
    async hasOwnStacktrace => {
      const stacktrace: StacktraceType = {
        frames: [
          FrameFixture({
            platform: 'python',
            filename: 'example.py',
            function: 'run',
            lineNo: 42,
          }),
        ],
        framesOmitted: null,
        registers: {},
        hasSystemFrames: false,
      };
      const event = EventFixture({
        platform: 'python',
        entries: [
          {
            type: EntryType.EXCEPTION,
            data: {
              values: [
                ExceptionValueFixture({
                  type: 'ExampleError',
                  value: 'Example failure',
                  threadId: 1,
                  stacktrace: hasOwnStacktrace ? stacktrace : null,
                }),
              ],
            },
          },
          {
            type: EntryType.THREADS,
            data: {
              values: [
                {
                  id: 1,
                  crashed: true,
                  stacktrace,
                },
              ],
            },
          },
        ],
      });
      render(<CopySection event={event} activeThreadId={1} />);
      await userEvent.click(screen.getByRole('button', {name: 'Copy as'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Text'}));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Traceback (most recent call last):\n  File "example.py", line 42, in run\nExampleError: Example failure'
      );
    }
  );

  it('copies the unsymbolicated exception and frames from its thread', async () => {
    const stacktrace: StacktraceType = {
      frames: [
        FrameFixture({
          platform: 'java',
          module: 'example.Worker',
          function: 'run',
          filename: 'Worker.java',
          lineNo: 42,
        }),
      ],
      framesOmitted: null,
      registers: {},
      hasSystemFrames: true,
    };
    const event = EventFixture({
      platform: 'java',
      entries: [
        {
          type: EntryType.EXCEPTION,
          data: {
            values: [
              ExceptionValueFixture({
                type: 'ExampleError',
                value: 'Example failure',
                rawType: 'a',
                rawValue: 'Raw failure',
                threadId: 1,
              }),
            ],
          },
        },
        {
          type: EntryType.THREADS,
          data: {
            values: [
              {
                id: 1,
                crashed: true,
                stacktrace,
                rawStacktrace: {
                  ...stacktrace,
                  frames: [
                    FrameFixture({
                      platform: 'java',
                      module: 'a.b',
                      function: 'c',
                      filename: 'a.java',
                      lineNo: 3,
                    }),
                  ],
                },
              },
            ],
          },
        },
      ],
    });
    render(<CopySection event={event} activeThreadId={1} />);
    await userEvent.click(screen.getByRole('button', {name: 'Display as'}));
    await userEvent.click(screen.getByRole('option', {name: 'Unsymbolicated'}));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', {name: 'Copy as'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Text'}));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'a: Raw failure\n    at a.b.c(a.java:3)'
    );
  });
});
