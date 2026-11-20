import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';

import {binaryOutput} from './binary';
import {defaultOutput} from './default';
import {getClassifierOutput} from './index';

describe('getClassifierOutput', () => {
  it('uses the binary output for binary classifiers with a threshold', () => {
    expect(
      getClassifierOutput(
        TelemetryClassifierFixture({outputType: 'binary', binaryThreshold: 0.8})
      )
    ).toBe(binaryOutput);
  });

  it.each([
    {name: 'binary without a threshold', outputType: 'binary', binaryThreshold: null},
    {name: 'without an output type', outputType: null, binaryThreshold: 0.8},
    {name: 'score without a threshold', outputType: 'score', binaryThreshold: null},
    {name: 'choice with a stray threshold', outputType: 'choice', binaryThreshold: 0.8},
  ] as const)(
    'uses the default output for classifiers $name',
    ({outputType, binaryThreshold}) => {
      expect(
        getClassifierOutput(TelemetryClassifierFixture({outputType, binaryThreshold}))
      ).toBe(defaultOutput);
    }
  );
});
