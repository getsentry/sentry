import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Threads from 'app/components/events/interfaces/threads';

describe('Threads', () => {
  const entries = TestStubs.Entries()[0];
  const event = TestStubs.Event({entries});
  const exceptionEntry = entries[0];
  const data = exceptionEntry.data;
  const type = exceptionEntry.type;

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

    const wrapper = mountWithTheme(
      <Threads
        type={type}
        data={data}
        orgId="org-slug"
        projectId="project-id"
        event={newEvent}
      />
    );

    // Total frames passed
    const totalFramesPasses =
      newEvent.entries[0].data.values[0].stacktrace.frames.length +
      newEvent.entries[0].data.values[1].stacktrace.frames.length;

    expect(wrapper.find('Line').length).toBe(totalFramesPasses);
  });

  it('Display no frame', () => {
    const wrapper = mountWithTheme(
      <Threads
        type={type}
        data={{...data, values: [{...data.values[0], stacktrace: null}]}}
        orgId="org-slug"
        projectId="project-id"
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

    // no exceptions or stacktraces have been found
    expect(wrapper.find('Line').length).toBe(0);
  });

  describe('Displays frame exception or a data of the active Thread if data.values.length equals 1 && data.values[0].threadId equals null', () => {
    const threadsEntry = entries[1];

    it('Displays the exception stacktrace', () => {
      const wrapper = mountWithTheme(
        <Threads
          type={threadsEntry.type}
          data={threadsEntry.data}
          orgId="org-slug"
          projectId="project-id"
          event={event}
        />
      );

      // envent.entries[0].data.values[0].stacktrace is defined
      expect(wrapper.find('Line').length).toBe(1);
    });

    it('Displays the the active thread stacktrace', () => {
      const wrapper = mountWithTheme(
        <Threads
          type={threadsEntry.type}
          data={threadsEntry.data}
          orgId="org-slug"
          projectId="project-id"
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
      expect(wrapper.find('Line').length).toBe(22);
    });
  });
});
