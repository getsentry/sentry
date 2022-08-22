import {useContext} from 'react';

import {CustomMeasurementsContext} from 'sentry/utils/customMeasurements/customMeasurementsContext';

export default function useCustomMeasurements() {
  const customMeasurementsContext = useContext(CustomMeasurementsContext);

  if (!customMeasurementsContext) {
    throw new Error(
      'useCustomMeasurements was called outside of CustomMeasurementsProvider'
    );
  }

  return customMeasurementsContext;
}
