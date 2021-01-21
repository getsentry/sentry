import {Location} from 'history';

import {Organization} from 'app/types';
import {AggregationKey, Column} from 'app/utils/discover/fields';
import {
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
  getDuration,
} from 'app/utils/formatters';
import {decodeScalar} from 'app/utils/queryString';

import {HistogramData, Rectangle} from '../transactionVitals/types';

type LandingDisplay = {
  label: string;
  field: LandingDisplayField;
};

export enum LandingDisplayField {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
}

export const LANDING_DISPLAYS = [
  {
    label: 'Frontend',
    field: LandingDisplayField.FRONTEND,
  },
  {
    label: 'Backend',
    field: LandingDisplayField.BACKEND,
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

export function getBackendFunction(
  functionName: AggregationKey,
  organization: Organization
): Column {
  switch (functionName) {
    case 'p75':
      return {kind: 'function', function: ['p75', 'transaction.duration', undefined]};
    case 'tpm':
      return {kind: 'function', function: ['tpm', '', undefined]};
    case 'failure_rate':
      return {kind: 'function', function: ['failure_rate', '', undefined]};
    case 'apdex':
      return {
        kind: 'function',
        function: ['apdex', `${organization.apdexThreshold}`, undefined],
      };
    default:
      throw new Error(`Unsupported backend function: ${functionName}`);
  }
}

export const backendCardDetails = {
  p75: {
    title: 'Duration (p75)',
    tooltip: 'Duration (p75)',
    formatter: value => getDuration(value / 1000, value >= 1000 ? 3 : 0, true),
  },
  tpm: {
    title: 'Throughput',
    tooltip: 'Throughput',
    formatter: formatAbbreviatedNumber,
  },
  failure_rate: {
    title: 'Failure Rate',
    tooltip: 'Failure Rate',
    formatter: value => formatPercentage(value, 2),
  },
  apdex: {
    title: 'Apdex',
    tooltip: 'Apdex',
    formatter: value => formatFloat(value, 4),
  },
};
