import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Threads from 'app/components/events/interfaces/threads/threads';

describe('Threads', () => {
  let event;
  let type;
  let data;

  beforeEach(() => {
    const entries = TestStubs.Entries()[0];
    event = TestStubs.Event({entries});
    const exceptionEntry = entries[0];
    data = exceptionEntry.data;
    type = exceptionEntry.type;
  });

  it('Display multiple frames', () => {
    event.entries[0].data.values[1] = {
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
    };

    const wrapper = mountWithTheme(
      <Threads
        type={type}
        data={data}
        orgId="org-slug"
        projectId="project-id"
        event={event}
      />
    );

    // total frames passed
    const totalFramesPasses =
      event.entries[0].data.values[0].stacktrace.frames.length +
      event.entries[0].data.values[1].stacktrace.frames.length;

    expect(wrapper.find('Line').length).toBe(totalFramesPasses);
  });

  it('Display no frame', () => {
    delete event.entries[0].data.values[0].stacktrace;
    data.values[0].id = '1';

    const wrapper = mountWithTheme(
      <Threads
        type={type}
        data={data}
        orgId="org-slug"
        projectId="project-id"
        event={event}
      />
    );

    // no exceptions or stacktraces have been found
    expect(wrapper.find('Line').length).toBe(0);
  });

  it('Displays frame exception if data.values.length equals 1 && data.values[0].threadId equals null', () => {
    const wrapper = mountWithTheme(
      <Threads
        type={type}
        data={data}
        orgId="org-slug"
        projectId="project-id"
        event={event}
      />
    );

    // data.values of an exception's entry has threadId equals null and length equals 1
    expect(wrapper.find('Line').length).toBe(1);
  });
});
