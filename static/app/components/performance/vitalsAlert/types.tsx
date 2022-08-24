import type {VITALS_TYPES} from './constants';

export type VitalsKey = typeof VITALS_TYPES[number];

type VitalsTimingResult = {
  [key in VitalsKey]: number;
};

interface BaseVitalsResult extends VitalsTimingResult {
  appColdStartCount: number;
  appWarmStartCount: number;
  fcpCount: number;
  lcpCount: number;
}

export interface VitalsResult extends BaseVitalsResult {
  projectData: Array<BaseVitalsResult & {projectId: string}>;
}
