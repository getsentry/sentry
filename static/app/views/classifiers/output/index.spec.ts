import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';

import {binaryOutput} from './binary';
import {defaultOutput} from './default';
import {getClassifierOutput} from './index';

describe('getClassifierOutput', () => {
  it('uses the binary output for binary classifiers', () => {
    expect(
      getClassifierOutput(
        TelemetryClassifierFixture({outputType: 'binary', binaryThreshold: 0.8})
      )
    ).toBe(binaryOutput);
  });

  it.each([
    {name: 'without an output type', outputType: null, binaryThreshold: null},
    {name: 'with a score output', outputType: 'score', binaryThreshold: null},
    {name: 'with a choice output', outputType: 'choice', binaryThreshold: null},
  ] as const)(
    'uses the default output for classifiers $name',
    ({outputType, binaryThreshold}) => {
      expect(
        getClassifierOutput(TelemetryClassifierFixture({outputType, binaryThreshold}))
      ).toBe(defaultOutput);
    }
  );
});
