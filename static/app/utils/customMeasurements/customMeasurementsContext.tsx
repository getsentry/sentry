import {createContext} from 'react';

import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';

export interface CustomMeasurementsContextValue {
  customMeasurements: CustomMeasurementCollection;
}

export const CustomMeasurementsContext = createContext<
  CustomMeasurementsContextValue | undefined
>(undefined);
