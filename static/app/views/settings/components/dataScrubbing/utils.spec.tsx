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

  describe('fromField', () => {
    it('escapes single quotes in attribute names so they round-trip', () => {
      const alias = "**.naam || **.'e-mail'";
      const selector = TraceItemFieldSelector.fromField(
        AllowedDataScrubbingDatasets.LOGS,
        alias
      );
      expect(selector?.getSelector()).toBe(
        "$log.attributes.'**.naam || **.''e-mail'''.value"
      );
      expect(selector?.toField()).toBe(alias);
      expect(
        TraceItemFieldSelector.fromSourceString(selector!.getSelector())?.toField()
      ).toBe(alias);
    });

    it('escapes single quotes for trace metric attributes', () => {
      const selector = TraceItemFieldSelector.fromField(
        AllowedDataScrubbingDatasets.METRICS,
        "it's"
      );
      expect(selector?.getSelector()).toBe("$trace_metric.attributes.'it''s'.value");
      expect(selector?.toField()).toBe("it's");
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
