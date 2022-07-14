import {VITALS_TYPES} from './constants';

interface BaseVitalsResult {
  FCP: number | null;
  LCP: number | null;
  appColdStartCount: number;
  appStartCold: number | null;
  appStartWarm: number | null;
  appWarmStartCount: number;
  fcpCount: number;
  lcpCount: number;
}

export interface VitalsResult extends BaseVitalsResult {
  projectData: Array<BaseVitalsResult & {projectId: string}>;
}

export type VitalsKey = typeof VITALS_TYPES[number];
