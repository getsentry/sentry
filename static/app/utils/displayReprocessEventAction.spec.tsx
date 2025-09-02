import {
  EventStacktraceExceptionFixture,
  EventStacktraceMessageFixture,
} from 'sentry-fixture/eventStacktraceException';

import {displayReprocessEventAction} from 'sentry/utils/displayReprocessEventAction';

describe('DisplayReprocessEventAction', () => {
  it('returns false in case of no event', () => {
    expect(displayReprocessEventAction(null)).toBe(false);
  });

  it('returns false if no exception entry is found', () => {
    const event = EventStacktraceMessageFixture();
    expect(displayReprocessEventAction(event)).toBe(false);
  });

  it('returns false if the event is not a mini-dump event or an Apple crash report event or a Native event', () => {
    const event = EventStacktraceExceptionFixture();
    expect(displayReprocessEventAction(event)).toBe(false);
  });

  describe('returns true', () => {
    describe('native event', () => {
      describe('event with defined platform', () => {
        it('native', () => {
          const event = EventStacktraceExceptionFixture({
            platform: 'native',
          });

          expect(displayReprocessEventAction(event)).toBe(true);
        });

        it('cocoa', () => {
          const event = EventStacktraceExceptionFixture({
            platform: 'cocoa',
          });

          expect(displayReprocessEventAction(event)).toBe(true);
        });
      });

      describe('event with undefined platform, but stack trace has platform', () => {
        it('native', () => {
          const event = EventStacktraceExceptionFixture({
            platform: undefined,
          });

          event.entries[0]!.data.values[0].stacktrace.frames[0].platform = 'native';

          expect(displayReprocessEventAction(event)).toBe(true);
        });

        it('cocoa', () => {
          const event = EventStacktraceExceptionFixture({
            platform: undefined,
          });

          event.entries[0]!.data.values[0].stacktrace.frames[0].platform = 'cocoa';

          expect(displayReprocessEventAction(event)).toBe(true);
        });
      });
    });

    it('mini-dump event', () => {
      const event = EventStacktraceExceptionFixture({
        platform: undefined,
      });

      event.entries[0]!.data.values[0] = {
        ...event.entries[0]!.data.values[0],
        mechanism: {
          type: 'minidump',
        },
      };

      expect(displayReprocessEventAction(event)).toBe(true);
    });

    it('apple crash report event', () => {
      const event = EventStacktraceExceptionFixture({
        platform: undefined,
      });

      event.entries[0]!.data.values[0] = {
        ...event.entries[0]!.data.values[0],
        mechanism: {
          type: 'applecrashreport',
        },
      };

      expect(displayReprocessEventAction(event)).toBe(true);
    });
  });
});
