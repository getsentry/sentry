import {Measurement} from 'sentry/utils/measurements/measurements';

export type CustomMeasurement = Measurement & {
  functions: string[];
};

export type CustomMeasurementCollection = Record<string, CustomMeasurement>;
