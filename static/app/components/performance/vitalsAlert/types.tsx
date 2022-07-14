import {VITALS_TYPES} from './constants';

export type VitalsKey = typeof VITALS_TYPES[number];

interface BaseVitalsResult {
  [key: VitalsKey]: number;
  appColdStartCount: number;
  appWarmStartCount: number;
  fcpCount: number;
  lcpCount: number;
}

// couldn't figure out how to do this with an interface
export type VitalsResult = BaseVitalsResult & {
  projectData: Array<BaseVitalsResult & {projectId: string}>;
};
