import React from 'react';

import {WEB_VITAL_DETAILS} from 'app/views/performance/transactionVitals/constants';

type Measurement = {
  name: string;
  key: string;
};

type MeasurementCollection = {[key: string]: Measurement};

const MEASUREMENTS: MeasurementCollection = Object.fromEntries(
  Object.entries(WEB_VITAL_DETAILS).map(([key, value]) => {
    const newValue: Measurement = {
      name: value.name,
      key,
    };
    return [key, newValue];
  })
);

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
