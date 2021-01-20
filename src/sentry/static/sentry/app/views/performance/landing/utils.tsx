import {Location} from 'history';

import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {backend, frontend} from 'app/data/platformCategories';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {AggregationKey, Column} from 'app/utils/discover/fields';
import {
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
  getDuration,
} from 'app/utils/formatters';
import {decodeScalar} from 'app/utils/queryString';

import {AxisOption} from '../data';
import {HistogramData, Rectangle} from '../transactionVitals/types';

export const LEFT_AXIS_QUERY_KEY = 'left';
export const RIGHT_AXIS_QUERY_KEY = 'right';

type LandingDisplay = {
  label: string;
  field: LandingDisplayField;
};

export enum LandingDisplayField {
  ALL = 'all',
  FRONTEND = 'frontend',
  BACKEND = 'backend',
}

export const LANDING_DISPLAYS = [
  {
    label: 'All',
    field: LandingDisplayField.ALL,
  },
  {
    label: 'Frontend',
    field: LandingDisplayField.FRONTEND,
  },
  {
    label: 'Backend',
    field: LandingDisplayField.BACKEND,
  },
];

export function getCurrentLandingDisplay(
  location: Location,
  eventView: EventView,
  projects: Project[]
): LandingDisplay {
  const landingField = decodeScalar(location?.query?.landingDisplay);
  const display = LANDING_DISPLAYS.find(({field}) => field === landingField);
  if (display) {
    return display;
  }

  const defaultDisplayField = getDefaultDisplayFieldForPlatform(eventView, projects);
  const defaultDisplay = LANDING_DISPLAYS.find(
    ({field}) => field === defaultDisplayField
  );
  return defaultDisplay || LANDING_DISPLAYS[0];
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

const VITALS_FRONTEND_PLATFORMS: string[] = [...frontend];
const VITALS_BACKEND_PLATFORMS: string[] = [...backend];

export function getDefaultDisplayFieldForPlatform(
  eventView: EventView,
  projects: Project[]
) {
  if (!eventView) {
    return LandingDisplayField.ALL;
  }
  const projectIds = eventView.project;
  if (
    projectIds.length > 1 ||
    projectIds.length === 0 ||
    projectIds[0] === ALL_ACCESS_PROJECTS
  ) {
    return LandingDisplayField.ALL;
  }
  const projectId = eventView.project[0];
  const project = projects.find(p => p.id === `${projectId}`);
  if (!project || !project.platform) {
    return LandingDisplayField.ALL;
  }

  if (VITALS_FRONTEND_PLATFORMS.includes(project.platform as string)) {
    return LandingDisplayField.FRONTEND;
  }

  if (VITALS_BACKEND_PLATFORMS.includes(project.platform as string)) {
    return LandingDisplayField.BACKEND;
  }

  return LandingDisplayField.ALL;
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

export function getDisplayAxes(options: AxisOption[], location: Location) {
  const leftDefault = options.find(opt => opt.isLeftDefault) || options[0];
  const rightDefault = options.find(opt => opt.isRightDefault) || options[1];

  const leftAxis =
    options.find(opt => opt.value === location.query[LEFT_AXIS_QUERY_KEY]) || leftDefault;
  const rightAxis =
    options.find(opt => opt.value === location.query[RIGHT_AXIS_QUERY_KEY]) ||
    rightDefault;
  return {
    leftAxis,
    rightAxis,
  };
}
