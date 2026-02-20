import {useContext} from 'react';

import {CustomMeasurementsContext} from 'sentry/utils/customMeasurements/customMeasurementsContext';

export default function useCustomMeasurements() {
  const customMeasurementsContext = useContext(CustomMeasurementsContext);

  if (!customMeasurementsContext) {
    if (process.env.NODE_ENV === 'test') {
      return {customMeasurements: {}};
    }

    throw new Error(
      'useCustomMeasurements was called outside of CustomMeasurementsProvider'
    );
  }

  return customMeasurementsContext;
}
