import {Measurement} from 'sentry/utils/measurements/measurements';

export type CustomMeasurement = Measurement & {
  fieldType: string;
  functions: string[];
  unit: string;
};

export type CustomMeasurementCollection = Record<string, CustomMeasurement>;
