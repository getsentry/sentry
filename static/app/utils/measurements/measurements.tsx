import {Fragment} from 'react';

import {
  MOBILE_VITAL_DETAILS,
  WEB_VITAL_DETAILS,
} from 'sentry/utils/performance/vitals/constants';
import {Vital} from 'sentry/utils/performance/vitals/types';

import {MobileVital, WebVital} from '../fields';

export type Measurement = {
  key: string;
  name: string;
};

export type MeasurementCollection = Record<string, Measurement>;

type VitalType = WebVital | MobileVital;

function measurementsFromDetails(
  details: Partial<Record<VitalType, Vital>>
): MeasurementCollection {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      const newValue: Measurement = {
        name: value.name,
        key,
      };
      return [key, newValue];
    })
  );
}

const MOBILE_MEASUREMENTS = measurementsFromDetails(MOBILE_VITAL_DETAILS);
const WEB_MEASUREMENTS = measurementsFromDetails(WEB_VITAL_DETAILS);

export function getMeasurements() {
  return {...WEB_MEASUREMENTS, ...MOBILE_MEASUREMENTS};
}

type ChildrenProps = {
  measurements: MeasurementCollection;
};

type Props = {
  children: (props: ChildrenProps) => React.ReactNode;
};

function Measurements({children}: Props) {
  const measurements = getMeasurements();
  return <Fragment>{children({measurements})}</Fragment>;
}

export default Measurements;
