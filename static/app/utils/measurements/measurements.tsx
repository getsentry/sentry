import {Fragment} from 'react';

import type {MobileVital, WebVital} from 'sentry/utils/fields';
import {
  MOBILE_VITAL_DETAILS,
  WEB_VITAL_DETAILS,
} from 'sentry/utils/performance/vitals/constants';
import type {Vital} from 'sentry/utils/performance/vitals/types';

export interface Measurement {
  key: string;
  name: string;
}

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

interface ChildrenProps {
  measurements: MeasurementCollection;
}

interface Props {
  children: (props: ChildrenProps) => React.ReactNode;
}

export function Measurements({children}: Props) {
  const measurements = getMeasurements();
  return <Fragment>{children({measurements})}</Fragment>;
}
