import * as Sentry from '@sentry/react';

import {
  AllowedDataScrubbingDatasets,
  MethodType,
  RuleType,
  type Rule,
} from 'sentry/views/settings/components/dataScrubbing/types';
import {TraceItemFieldSelector} from 'sentry/views/settings/components/dataScrubbing/utils';

function makeRule(source: string): Rule {
  return {id: 0, method: MethodType.MASK, type: RuleType.ANYTHING, source};
}

describe('TraceItemFieldSelector', () => {
  let captureExceptionSpy: jest.SpyInstance;

  beforeEach(() => {
    captureExceptionSpy = jest.spyOn(Sentry, 'captureException');
  });

  afterEach(() => {
    captureExceptionSpy.mockRestore();
  });

  it('treats $logentry selectors as default dataset selectors', () => {
    expect(TraceItemFieldSelector.fromRule(makeRule('$logentry.**'))).toBeNull();
    expect(TraceItemFieldSelector.fromSourceString('$logentry.formatted')).toBeNull();
    expect(captureExceptionSpy).not.toHaveBeenCalled();
  });

  it('returns null for regular event selectors', () => {
    expect(TraceItemFieldSelector.fromRule(makeRule('$message'))).toBeNull();
    expect(TraceItemFieldSelector.fromRule(makeRule('**'))).toBeNull();
  });

  it('parses log selectors', () => {
    const body = TraceItemFieldSelector.fromRule(makeRule('$log.body'));
    expect(body?.getDataset()).toBe(AllowedDataScrubbingDatasets.LOGS);
    expect(body?.toField()).toBe('message');

    const attribute = TraceItemFieldSelector.fromRule(
      makeRule("$log.attributes.'user.email'.value")
    );
    expect(attribute?.getDataset()).toBe(AllowedDataScrubbingDatasets.LOGS);
    expect(attribute?.toField()).toBe('user.email');
    expect(captureExceptionSpy).not.toHaveBeenCalled();
  });

  it('parses trace metric selectors', () => {
    const attribute = TraceItemFieldSelector.fromRule(
      makeRule("$trace_metric.attributes.'foo'.value")
    );
    expect(attribute?.getDataset()).toBe(AllowedDataScrubbingDatasets.METRICS);
    expect(attribute?.toField()).toBe('foo');
  });

  it('still reports log selectors that cannot be parsed', () => {
    const selector = TraceItemFieldSelector.fromRule(makeRule('$log.unknown'));
    expect(selector?.getDataset()).toBe(AllowedDataScrubbingDatasets.LOGS);
    expect(selector?.toField()).toBeNull();
    expect(captureExceptionSpy).toHaveBeenCalledTimes(1);
  });

  it('checks trace item fields with dataset prefixes', () => {
    expect(
      TraceItemFieldSelector.isTraceItemField(
        AllowedDataScrubbingDatasets.LOGS,
        '$logentry.**'
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
