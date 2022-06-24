import CustomMeasurementsStore from 'sentry/stores/customMeasurementsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {MeasurementCollection} from 'sentry/utils/measurements/measurements';

type Result = {
  customMeasurements: MeasurementCollection;
};

function useCustomMeasurements(): Result {
  const customMeasurements = useLegacyStore(CustomMeasurementsStore);

  return {
    customMeasurements,
  };
}

export default useCustomMeasurements;
