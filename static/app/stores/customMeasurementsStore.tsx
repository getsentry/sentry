import {createStore} from 'reflux';

import {CustomMeasurementMetaResponse} from 'sentry/actionCreators/customMeasurements';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';
import {MeasurementCollection} from 'sentry/utils/measurements/measurements';

import {CommonStoreDefinition} from './types';

interface CustomMeasurementsStoreDefinition
  extends CommonStoreDefinition<MeasurementCollection> {
  getAllCustomMeasurements(): MeasurementCollection;
  loadCustomMeasurementsSuccess(data: CustomMeasurementMetaResponse): void;
  reset(): void;
  state: MeasurementCollection;
}

const storeConfig: CustomMeasurementsStoreDefinition = {
  state: {},
  unsubscribeListeners: [],

  init() {
    this.state = {};
  },

  reset() {
    this.state = {};
    this.trigger(this.state);
  },

  getAllCustomMeasurements() {
    return this.state;
  },

  getState() {
    return this.getAllCustomMeasurements();
  },

  loadCustomMeasurementsSuccess(data) {
    const newCustomMeasurements = Object.keys(data).reduce<MeasurementCollection>(
      (acc, customMeasurement) => {
        acc[customMeasurement] = {
          key: customMeasurement,
          name: customMeasurement,
        };

        return acc;
      },
      {}
    );

    this.state = {...this.state, ...newCustomMeasurements};
    this.trigger(this.state);
  },
};

const CustomMeasurementsStore = createStore(makeSafeRefluxStore(storeConfig));
export default CustomMeasurementsStore;
