import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Threads} from 'sentry/components/events/interfaces/threads';

describe('Threads', () => {
  const entries = TestStubs.Entries()[0];
  const event = TestStubs.Event({entries});
  const exceptionEntry = entries[0];
  const data = exceptionEntry.data;

  it('Display multiple frames', () => {
    const newEvent = {
      ...event,
      entries: [
        {
          ...event.entries[0],
          data: {
            ...event.entries[0].data,
            values: [
              event.entries[0].data.values[0],
              {
                module: 'example.application',
                type: 'Error',
                value: 'an error occurred',
                stacktrace: {
                  frames: [
                    {
                      function: 'main',
                      module: 'example.application',
                      lineNo: 1,
                      filename: 'application',
                    },
                    {
                      function: 'doThing',
                      module: 'example.application',
                      lineNo: 2,
                      filename: 'application',
                    },
                  ],
                },
              },
            ],
          },
        },
        event.entries[1],
        event.entries[2],
      ],
    };

    render(
      <Threads
        data={data}
        hasHierarchicalGrouping={false}
        projectSlug="project-id"
        event={newEvent}
      />
    );

    // Total frames passed
    const totalFramesPasses =
      newEvent.entries[0].data.values[0].stacktrace.frames.length +
      newEvent.entries[0].data.values[1].stacktrace.frames.length;

    expect(screen.getAllByTestId('line')).toHaveLength(totalFramesPasses);
  });

  it('Display no frame', () => {
    render(
      <Threads
        data={{...data, values: [{...data.values[0], stacktrace: null}]}}
        hasHierarchicalGrouping={false}
        projectSlug="project-id"
        event={{
          ...event,
          entries: [
            {
              ...event.entries[0],
              data: {
                ...event.entries[0].data,
                values: [{...event.entries[0].data.values[0], id: 0, stacktrace: null}],
              },
            },
            event.entries[1],
            event.entries[2],
          ],
        }}
      />
    );

    expect(screen.queryByTestId('line')).not.toBeInTheDocument();
  });

  describe('Displays the stack trace of an exception if all threadIds of exceptionEntry.data.values do not match the threadId of the active thread and if the active thread has crashed equals true', () => {
    const threadsEntry = entries[1];

    it('Displays the exception stacktrace', () => {
      render(
        <Threads
          data={threadsEntry.data}
          projectSlug="project-id"
          event={event}
          hasHierarchicalGrouping={false}
        />
      );

      // envent.entries[0].data.values[0].stacktrace is defined
      expect(screen.getByTestId('line')).toBeInTheDocument();
    });

    it('Displays the the active thread stacktrace', () => {
      render(
        <Threads
          data={threadsEntry.data}
          hasHierarchicalGrouping={false}
          projectSlug="project-id"
          event={{
            ...event,
            entries: [
              {
                ...event.entries[0],
                data: {
                  ...event.entries[0].data,
                  values: [{...event.entries[0].data.values[0], stacktrace: null}],
                },
              },
              event.entries[1],
              event.entries[2],
            ],
          }}
        />
      );

      // the 'threads' entry has a stack trace with 23 frames, but as one of them is duplicated, we only display 22
      expect(screen.getAllByTestId('line')).toHaveLength(22);
    });
  });

  describe('Thread selector', () => {
    it('renders thread selector with state', () => {
      const threadsEntry = entries[1];
      render(
        <Threads
          data={threadsEntry.data}
          projectSlug="project-id"
          event={event}
          hasHierarchicalGrouping={false}
        />
      );
      expect(
        screen.getByText('ViewController.captureNSException (RUNNABLE)')
      ).toBeInTheDocument();
      userEvent.click(screen.getByText('ViewController.captureNSException (RUNNABLE)'));
      expect(screen.getByText('State')).toBeInTheDocument();
    });

    it('maps android vm states to java vm states', () => {
      const threadsEntry = entries[1];
      threadsEntry.data.values[0].state = 'kWaitingPerformingGc';
      render(
        <Threads
          data={threadsEntry.data}
          projectSlug="project-id"
          event={event}
          hasHierarchicalGrouping={false}
        />
      );

      // kWaitingPerformingGc maps to WAITING
      expect(
        screen.getByText('ViewController.captureNSException (WAITING)')
      ).toBeInTheDocument();
      userEvent.click(screen.getByText('ViewController.captureNSException (WAITING)'));
      expect(screen.getByText('State')).toBeInTheDocument();
    });
  });
});
