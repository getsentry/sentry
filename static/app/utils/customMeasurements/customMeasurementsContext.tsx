import {createContext} from 'react';

import type {CustomMeasurementCollection} from './customMeasurements';

const emptyCustomMeasurements: CustomMeasurementCollection = {};

export const CustomMeasurementsContext = createContext({
  customMeasurements: emptyCustomMeasurements,
});
