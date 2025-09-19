import type {Theme} from '@emotion/react';
import Color from 'color';

export const COUNT_COLOR = (theme: Theme) => theme.chart.getColorPalette(0)[0];
export const THROUGHPUT_COLOR = (theme: Theme) => theme.chart.getColorPalette(3)[3];
export const AVG_COLOR = (theme: Theme) => theme.chart.getColorPalette(0)[0];

// TODO: Synchronize with `theme.tsx` or `CHART_PALETTE`
export const HTTP_RESPONSE_3XX_COLOR = '#F2B712';
export const HTTP_RESPONSE_4XX_COLOR = '#F58C46';
export const HTTP_RESPONSE_5XX_COLOR = '#E9626E';

const COLD_START_COLOR = '#3C74DD';

export const PRIMARY_RELEASE_COLOR = '#3C74DD'; // COLD_START_COLOR
export const SECONDARY_RELEASE_COLOR = Color(COLD_START_COLOR).lighten(0.4).string();
