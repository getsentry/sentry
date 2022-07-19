import {VITALS_TYPES} from './constants';

export type VitalsKey = typeof VITALS_TYPES[number];

type MyType = {
  [key in VitalsKey]: number;
};

interface BaseVitalsResult extends MyType {
  appColdStartCount: number;
  appWarmStartCount: number;
  fcpCount: number;
  lcpCount: number;
}

export interface VitalsResult extends BaseVitalsResult {
  projectData: Array<BaseVitalsResult & {projectId: string}>;
}
