import {Location} from 'history';

import {decodeScalar} from 'app/utils/queryString';

import {HistogramData, Rectangle} from '../transactionVitals/types';

type LandingDisplay = {
  label: string;
  field: LandingDisplayField;
};

export enum LandingDisplayField {
  FRONTEND = 'frontend',
}

export const LANDING_DISPLAYS = [
  {
    label: 'Frontend',
    field: LandingDisplayField.FRONTEND,
  },
];

export function getCurrentLandingDisplay(location: Location): LandingDisplay {
  const landingField = decodeScalar(location?.query?.landingDisplay);
  const display = LANDING_DISPLAYS.find(({field}) => field === landingField);
  return display || LANDING_DISPLAYS[0];
}

export function getChartWidth(
  chartData: HistogramData[],
  refPixelRect: Rectangle | null
) {
  const distance = refPixelRect ? refPixelRect.point2.x - refPixelRect.point1.x : 0;
  const chartWidth = chartData.length * distance;

  return {
    chartWidth,
  };
}
