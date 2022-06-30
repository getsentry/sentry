import {createContext} from 'react';

import {MeasurementCollection} from 'sentry/utils/measurements/measurements';

export interface CustomMeasurementsContextValue {
  customMeasurements: MeasurementCollection;
}

export const CustomMeasurementsContext = createContext<
  CustomMeasurementsContextValue | undefined
>(undefined);
