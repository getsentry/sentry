import {AllowedDataScrubbingDatasets} from './types';
import {TraceItemFieldSelector} from './utils';

describe('TraceItemFieldSelector', () => {
  describe('fromSourceString', () => {
    it.each(['$logentry', '$logentry.formatted', '$logentry.params', '$message'])(
      'does not treat event selector %s as a trace item selector',
      source => {
        expect(TraceItemFieldSelector.fromSourceString(source)).toBeNull();
      }
    );

    it('parses the log body selector', () => {
      const selector = TraceItemFieldSelector.fromSourceString('$log.body');
      expect(selector?.getDataset()).toBe(AllowedDataScrubbingDatasets.LOGS);
      expect(selector?.toField()).toBe('message');
    });

    it('parses log attribute selectors', () => {
      const selector = TraceItemFieldSelector.fromSourceString(
        "$log.attributes.'user.email'.value"
      );
      expect(selector?.getDataset()).toBe(AllowedDataScrubbingDatasets.LOGS);
      expect(selector?.toField()).toBe('user.email');
    });

    it('parses trace metric attribute selectors', () => {
      const selector = TraceItemFieldSelector.fromSourceString(
        "$trace_metric.attributes.'foo'.value"
      );
      expect(selector?.getDataset()).toBe(AllowedDataScrubbingDatasets.METRICS);
      expect(selector?.toField()).toBe('foo');
    });
  });

  describe('isTraceItemField', () => {
    it('does not match $logentry for the logs dataset', () => {
      expect(
        TraceItemFieldSelector.isTraceItemField(
          AllowedDataScrubbingDatasets.LOGS,
          '$logentry'
        )
      ).toBe(false);
      expect(
        TraceItemFieldSelector.isTraceItemField(
          AllowedDataScrubbingDatasets.LOGS,
          '$log.body'
        )
      ).toBe(true);
    });
  });
});
