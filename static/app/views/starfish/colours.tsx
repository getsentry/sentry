import Color from 'color';

import {CHART_PALETTE} from 'sentry/constants/chartPalette';

export const COUNT_COLOUR = CHART_PALETTE[0][0];
export const THROUGHPUT_COLOR = CHART_PALETTE[3][3];
export const P50_COLOR = CHART_PALETTE[3][1];
export const P95_COLOR = CHART_PALETTE[0][0];
export const AVG_COLOR = CHART_PALETTE[0][0];
export const ERRORS_COLOR = CHART_PALETTE[5][3];

export const HTTP_RESPONSE_3XX_COLOR = CHART_PALETTE[2][0];
export const HTTP_RESPONSE_4XX_COLOR = CHART_PALETTE[2][2];
export const HTTP_RESPONSE_5XX_COLOR = CHART_PALETTE[2][1];

export const COLD_START_COLOR = '#3C74DD';
export const WARM_START_COLOR = '#3A2D96';

export const PRIMARY_RELEASE_COLOR = COLD_START_COLOR;
export const SECONDARY_RELEASE_COLOR = Color(COLD_START_COLOR).lighten(0.4).string();
