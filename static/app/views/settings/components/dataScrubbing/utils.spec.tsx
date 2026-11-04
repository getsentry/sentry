import * as Sentry from '@sentry/react';

import {AllowedDataScrubbingDatasets} from 'sentry/views/settings/components/dataScrubbing/types';
import {TraceItemFieldSelector} from 'sentry/views/settings/components/dataScrubbing/utils';

describe('TraceItemFieldSelector', () => {
  let captureException: jest.SpyInstance;

  beforeEach(() => {
    captureException = jest.spyOn(Sentry, 'captureException').mockImplementation();
  });

  afterEach(() => {
    captureException.mockRestore();
  });

  it.each(['$logentry.formatted', '$logentry.params.*.kwargsrepr', '$trace_metrics'])(
    'does not treat %s as a trace item selector',
    selector => {
      expect(TraceItemFieldSelector.fromSourceString(selector)).toBeNull();
      expect(
        TraceItemFieldSelector.isTraceItemField(
          AllowedDataScrubbingDatasets.LOGS,
          selector
        )
      ).toBe(false);
      expect(captureException).not.toHaveBeenCalled();
    }
  );

  it('maps log selectors to fields', () => {
    const body = TraceItemFieldSelector.fromSourceString('$log.body');
    expect(body?.getDataset()).toBe(AllowedDataScrubbingDatasets.LOGS);
    expect(body?.toField()).toBe('message');

    const attribute = TraceItemFieldSelector.fromSourceString(
      "$log.attributes.'user.email'.value"
    );
    expect(attribute?.getDataset()).toBe(AllowedDataScrubbingDatasets.LOGS);
    expect(attribute?.toField()).toBe('user.email');
    expect(captureException).not.toHaveBeenCalled();
  });

  it('maps metric selectors to fields', () => {
    const selector = TraceItemFieldSelector.fromSourceString(
      "$trace_metric.attributes.'foo'.value"
    );
    expect(selector?.getDataset()).toBe(AllowedDataScrubbingDatasets.METRICS);
    expect(selector?.toField()).toBe('foo');
  });

  it('still reports malformed log selectors', () => {
    expect(TraceItemFieldSelector.fromSourceString('$log.unknown')?.toField()).toBeNull();
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
