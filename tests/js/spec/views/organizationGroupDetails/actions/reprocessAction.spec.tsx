import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Event} from 'app/types/event';
import ReprocessAction from 'app/views/organizationGroupDetails/actions/reprocessAction';

function renderComponent(event?: Event) {
  return mountWithTheme(
    <ReprocessAction disabled={false} onClick={jest.fn()} event={event} />
  );
}

describe('ReprocessAction', function () {
  it('returns null in case of no event', function () {
    const wrapper = renderComponent();
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('returns null if no exception entry is found', function () {
    // @ts-expect-error
    const event = TestStubs.EventStacktraceMessage();
    const wrapper = renderComponent(event);
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('returns null if the event is not a mini-dump event or an Apple crash report event or a Native event', function () {
    // @ts-expect-error
    const event = TestStubs.EventStacktraceException();
    const wrapper = renderComponent(event);
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  describe('returns the ActionButton element', function () {
    const onClick = jest.fn();

    describe('native event', function () {
      describe('event with defined platform', function () {
        it('native', function () {
          // @ts-expect-error
          const event = TestStubs.EventStacktraceException({
            platform: 'native',
          });

          const wrapper = renderComponent(event);

          const actionButton = wrapper.find('ActionButton');
          expect(actionButton).toBeTruthy();

          actionButton.simulate('click');
          expect(onClick).toHaveBeenCalled();

          expect(wrapper.isEmptyRender()).toBe(false);
        });

        it('cocoa', function () {
          // @ts-expect-error
          const event = TestStubs.EventStacktraceException({
            platform: 'cocoa',
          });

          const wrapper = renderComponent(event);

          const actionButton = wrapper.find('ActionButton');
          expect(actionButton).toBeTruthy();

          actionButton.simulate('click');
          expect(onClick).toHaveBeenCalled();

          expect(wrapper.isEmptyRender()).toBe(false);
        });
      });

      describe('event with undefined platform, but stack trace has platform', function () {
        it('native', function () {
          // @ts-expect-error
          const event = TestStubs.EventStacktraceException({
            platform: undefined,
          });

          event.entries[0].data.values[0].stacktrace.frames[0].platform = 'native';
          const wrapper = renderComponent(event);

          const actionButton = wrapper.find('ActionButton');
          expect(actionButton).toBeTruthy();

          actionButton.simulate('click');
          expect(onClick).toHaveBeenCalled();

          expect(wrapper.isEmptyRender()).toBe(false);
        });

        it('cocoa', function () {
          // @ts-expect-error
          const event = TestStubs.EventStacktraceException({
            platform: undefined,
          });

          event.entries[0].data.values[0].stacktrace.frames[0].platform = 'cocoa';
          const wrapper = renderComponent(event);

          const actionButton = wrapper.find('ActionButton');
          expect(actionButton).toBeTruthy();

          actionButton.simulate('click');
          expect(onClick).toHaveBeenCalled();

          expect(wrapper.isEmptyRender()).toBe(false);
        });
      });
    });

    it('mini-dump event', function () {
      // @ts-expect-error
      const event = TestStubs.EventStacktraceException({
        platform: undefined,
      });

      event.entries[0].data.values[0] = {
        ...event.entries[0].data.values[0],
        mechanism: {
          type: 'minidump',
        },
      };

      const wrapper = renderComponent(event);

      const actionButton = wrapper.find('ActionButton');
      expect(actionButton).toBeTruthy();

      actionButton.simulate('click');
      expect(onClick).toHaveBeenCalled();

      expect(wrapper.isEmptyRender()).toBe(false);
    });

    it('apple crash report event', function () {
      // @ts-expect-error
      const event = TestStubs.EventStacktraceException({
        platform: undefined,
      });

      event.entries[0].data.values[0] = {
        ...event.entries[0].data.values[0],
        mechanism: {
          type: 'applecrashreport',
        },
      };

      const wrapper = renderComponent(event);

      const actionButton = wrapper.find('ActionButton');
      expect(actionButton).toBeTruthy();

      actionButton.simulate('click');
      expect(onClick).toHaveBeenCalled();

      expect(wrapper.isEmptyRender()).toBe(false);
    });
  });
});
