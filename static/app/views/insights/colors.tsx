import type {Theme} from '@emotion/react';

export const COUNT_COLOR = (theme: Theme) => theme.chart.getColorPalette(0)[0];
export const THROUGHPUT_COLOR = (theme: Theme) => theme.chart.getColorPalette(3)[3];
export const AVG_COLOR = (theme: Theme) => theme.chart.getColorPalette(0)[0];

// TODO: Synchronize with `theme.tsx` or `CHART_PALETTE`
export const HTTP_RESPONSE_3XX_COLOR = '#F2B712';
export const HTTP_RESPONSE_4XX_COLOR = '#F58C46';
export const HTTP_RESPONSE_5XX_COLOR = '#E9626E';

export const PRIMARY_RELEASE_COLOR = '#3C74DD'; // COLD_START_COLOR
