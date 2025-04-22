import type {Measurement} from 'sentry/utils/measurements/measurements';

type CustomMeasurement = Measurement & {
  fieldType: string;
  functions: string[];
  unit: string;
};

export type CustomMeasurementCollection = Record<string, CustomMeasurement>;
