import React from 'react';

type Measurement = {
  name: string;
  key: string;
};

type MeasurementCollection = {[key: string]: Measurement};

const MEASUREMENTS: MeasurementCollection = {
  'measurements.fp': {name: 'First Paint', key: 'measurements.fp'},
  'measurements.fcp': {name: 'First Contentful Paint', key: 'measurements.fcp'},
  'measurements.lcp': {name: 'Largest Contentful Paint', key: 'measurements.lcp'},
  'measurements.fid': {name: 'First Input Delay', key: 'measurements.fid'},
  'measurements.cls': {name: 'Cumulative Layout Shift', key: 'measurements.cls'},
  'measurements.ttfb': {name: 'Time to First Byte', key: 'measurements.ttfb'},
  'measurements.ttfb.requesttime': {
    name: 'Request Time',
    key: 'measurements.ttfb.requesttime',
  },
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
