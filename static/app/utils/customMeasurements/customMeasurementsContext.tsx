import {createContext} from 'react';

import {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';

export interface CustomMeasurementsContextValue {
  customMeasurements: CustomMeasurementCollection;
}

export const CustomMeasurementsContext = createContext<
  CustomMeasurementsContextValue | undefined
>(undefined);
