import {useContext} from 'react';

import {CustomMeasurementsContext} from './customMeasurements/customMeasurementsContext';

export function useCustomMeasurements() {
  return useContext(CustomMeasurementsContext);
}
