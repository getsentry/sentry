import {createContext} from 'react';

import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';

export const CustomMeasurementsContext = createContext({
  customMeasurements: {},
});
