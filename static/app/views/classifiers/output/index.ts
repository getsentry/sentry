import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

import {binaryOutput} from './binary';
import {defaultOutput} from './default';
import type {ClassifierOutput} from './types';

export function getClassifierOutput(classifier: TelemetryClassifier): ClassifierOutput {
  return classifier.outputType === 'binary' && classifier.binaryThreshold !== null
    ? binaryOutput
    : defaultOutput;
}
