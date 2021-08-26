import * as React from 'react';

import {Organization} from 'app/types';
import {MobileVital, WebVital} from 'app/utils/discover/fields';
import {
  MOBILE_VITAL_DETAILS,
  WEB_VITAL_DETAILS,
} from 'app/utils/performance/vitals/constants';
import {Vital} from 'app/utils/performance/vitals/types';

type Measurement = {
  name: string;
  key: string;
};

type MeasurementCollection = Record<string, Measurement>;

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

type ChildrenProps = {
  measurements: MeasurementCollection;
};

type Props = {
  organization: Organization;
  children: (props: ChildrenProps) => React.ReactNode;
};

function Measurements({organization, children}: Props) {
  const measurements = organization.features.includes('performance-mobile-vitals')
    ? {...WEB_MEASUREMENTS, ...MOBILE_MEASUREMENTS}
    : WEB_MEASUREMENTS;
  return <React.Fragment>{children({measurements})}</React.Fragment>;
}

export default Measurements;
