import React from 'react';

import {MeasurementCollection} from 'app/types';

type InjectedMeasurementsProps = {
  measurements: MeasurementCollection;
};

const MEASUREMENTS: MeasurementCollection = {
  'measurements.fp': {name: 'First Paint', key: 'measurements.fp'},
  'measurements.fcp': {name: 'First Contentful Paint', key: 'measurements.fcp'},
  'measurements.lcp': {name: 'Largest Contentful Paint', key: 'measurements.lcp'},
  'measurements.fid': {name: 'First Input Delay', key: 'measurements.fid'},
};

const withMeasurements = <P extends InjectedMeasurementsProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  class extends React.Component<Omit<P, keyof InjectedMeasurementsProps>> {
    render() {
      return <WrappedComponent measurements={MEASUREMENTS} {...(this.props as P)} />;
    }
  };

export default withMeasurements;
