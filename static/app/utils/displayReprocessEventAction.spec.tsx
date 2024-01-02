import {
  EventStacktraceException as EventStacktraceExceptionFixture,
  EventStacktraceMessage,
} from 'sentry-fixture/eventStacktraceException';

import {displayReprocessEventAction} from 'sentry/utils/displayReprocessEventAction';

describe('DisplayReprocessEventAction', function () {
  const orgFeatures = ['reprocessing-v2'];

  it('returns false in case of no reprocessing-v2 feature', function () {
    const event = EventStacktraceMessage();
    expect(displayReprocessEventAction([], event)).toBe(false);
  });

  it('returns false in case of no event', function () {
    expect(displayReprocessEventAction(orgFeatures)).toBe(false);
  });

  it('returns false if no exception entry is found', function () {
    const event = EventStacktraceMessage();
    expect(displayReprocessEventAction(orgFeatures, event)).toBe(false);
  });

  it('returns false if the event is not a mini-dump event or an Apple crash report event or a Native event', function () {
    const event = EventStacktraceExceptionFixture();
    expect(displayReprocessEventAction(orgFeatures, event)).toBe(false);
  });

  describe('returns true', function () {
    describe('native event', function () {
      describe('event with defined platform', function () {
        it('native', function () {
          const event = EventStacktraceExceptionFixture({
            platform: 'native',
          });

          expect(displayReprocessEventAction(orgFeatures, event)).toBe(true);
        });

        it('cocoa', function () {
          const event = EventStacktraceExceptionFixture({
            platform: 'cocoa',
          });

          expect(displayReprocessEventAction(orgFeatures, event)).toBe(true);
        });
      });

      describe('event with undefined platform, but stack trace has platform', function () {
        it('native', function () {
          const event = EventStacktraceExceptionFixture({
            platform: undefined,
          });

          event.entries[0].data.values[0].stacktrace.frames[0].platform = 'native';

          expect(displayReprocessEventAction(orgFeatures, event)).toBe(true);
        });

        it('cocoa', function () {
          const event = EventStacktraceExceptionFixture({
            platform: undefined,
          });

          event.entries[0].data.values[0].stacktrace.frames[0].platform = 'cocoa';

          expect(displayReprocessEventAction(orgFeatures, event)).toBe(true);
        });
      });
    });

    it('mini-dump event', function () {
      const event = EventStacktraceExceptionFixture({
        platform: undefined,
      });

      event.entries[0].data.values[0] = {
        ...event.entries[0].data.values[0],
        mechanism: {
          type: 'minidump',
        },
      };

      expect(displayReprocessEventAction(orgFeatures, event)).toBe(true);
    });

    it('apple crash report event', function () {
      const event = EventStacktraceExceptionFixture({
        platform: undefined,
      });

      event.entries[0].data.values[0] = {
        ...event.entries[0].data.values[0],
        mechanism: {
          type: 'applecrashreport',
        },
      };

      expect(displayReprocessEventAction(orgFeatures, event)).toBe(true);
    });
  });
});
