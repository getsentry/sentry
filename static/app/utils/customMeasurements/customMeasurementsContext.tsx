import {createContext} from 'react';

import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';

const emptyCustomMeasurements: CustomMeasurementCollection = {};

export const CustomMeasurementsContext = createContext({
  customMeasurements: emptyCustomMeasurements,
});
