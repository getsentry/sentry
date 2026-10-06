import {useContext} from 'react';

import {CustomMeasurementsContext} from 'sentry/utils/customMeasurements/customMeasurementsContext';

export function useCustomMeasurements() {
  return useContext(CustomMeasurementsContext);
}
