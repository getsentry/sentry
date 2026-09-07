import {AllowedDataScrubbingDatasets} from 'sentry/views/settings/components/dataScrubbing/types';

import {TraceItemFieldSelector} from 'sentry/views/settings/components/dataScrubbing/utils';

describe('TraceItemFieldSelector', () => {
  describe('isTraceItemField', () => {
    it('correctly identifies valid LOGS selectors', () => {
      expect(
        TraceItemFieldSelector.isTraceItemField(AllowedDataScrubbingDatasets.LOGS, '$log')
      ).toBe(true);
      expect(
        TraceItemFieldSelector.isTraceItemField(
          AllowedDataScrubbingDatasets.LOGS,
          '$log.body'
        )
      ).toBe(true);
      expect(
        TraceItemFieldSelector.isTraceItemField(
          AllowedDataScrubbingDatasets.LOGS,
          "$log.attributes.'key'.value"
        )
      ).toBe(true);
    });

    it('does not misclassify legacy $logentry selectors as LOGS', () => {
      expect(
        TraceItemFieldSelector.isTraceItemField(
          AllowedDataScrubbingDatasets.LOGS,
          '$logentry.params.*.baggage'
        )
      ).toBe(false);
      expect(
        TraceItemFieldSelector.isTraceItemField(
          AllowedDataScrubbingDatasets.LOGS,
          '$logentry.params.*.args'
        )
      ).toBe(false);
      expect(
        TraceItemFieldSelector.isTraceItemField(
          AllowedDataScrubbingDatasets.LOGS,
          '$logentry.formatted'
        )
      ).toBe(false);
    });
  });

  describe('fromRule', () => {
    it('returns null for legacy $logentry selectors (treated as DEFAULT dataset)', () => {
      const rule = {source: '$logentry.params.*.baggage'} as any;
      expect(TraceItemFieldSelector.fromRule(rule)).toBeNull();
    });

    it('returns null for $logentry.params.*.args', () => {
      const rule = {source: '$logentry.params.*.args'} as any;
      expect(TraceItemFieldSelector.fromRule(rule)).toBeNull();
    });

    it('returns a TraceItemFieldSelector for valid $log selectors', () => {
      const rule = {source: '$log.body'} as any;
      const selector = TraceItemFieldSelector.fromRule(rule);
      expect(selector).not.toBeNull();
      expect(selector?.getDataset()).toBe(AllowedDataScrubbingDatasets.LOGS);
    });
  });
});
