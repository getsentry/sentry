import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {ModuleName} from 'sentry/views/starfish/types';

export const THROUGHPUT_COLOR = CHART_PALETTE[0][0];
export const P50_COLOR = CHART_PALETTE[2][2];
export const P95_COLOR = CHART_PALETTE[2][1];
export const ERRORS_COLOR = CHART_PALETTE[2][2];
export const MODULE_COLOR: Record<ModuleName, string> = {
  [ModuleName.HTTP]: CHART_PALETTE[3][3],
  [ModuleName.DB]: CHART_PALETTE[3][2],
  [ModuleName.NONE]: CHART_PALETTE[3][1],
  [ModuleName.ALL]: CHART_PALETTE[3][0],
};
