import React from 'react';

export type Measurement = {
  name: string;
  key: string;
};

export type MeasurementCollection = {[key: string]: Measurement};

const MEASUREMENTS: MeasurementCollection = {
  'measurements.fp': {name: 'First Paint', key: 'measurements.fp'},
  'measurements.fcp': {name: 'First Contentful Paint', key: 'measurements.fcp'},
  'measurements.lcp': {name: 'Largest Contentful Paint', key: 'measurements.lcp'},
  'measurements.fid': {name: 'First Input Delay', key: 'measurements.fid'},
};

type ChildrenProps = {
  measurements: MeasurementCollection;
};

type Props = {
  children: (props: ChildrenProps) => React.ReactNode;
};

function Measurements(props: Props) {
  return (
    <React.Fragment>
      {props.children({
        measurements: MEASUREMENTS,
      })}
    </React.Fragment>
  );
}

export default Measurements;
