type CustomMeasurement = {
  key: string;
  name: string;
  supportedFunctions: string[];
};

export type CustomMeasurementCollection = Record<string, CustomMeasurement>;
