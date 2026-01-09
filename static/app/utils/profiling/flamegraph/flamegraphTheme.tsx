import type {Theme} from '@emotion/react';

import {
  makeColorMapByApplicationFrame,
  makeColorMapByFrequency,
  makeColorMapByLibrary,
  makeColorMapByRecursion,
  makeColorMapBySymbolName,
  makeColorMapBySystemFrame,
  makeColorMapBySystemVsApplicationFrame,
  makeStackToColor,
} from 'sentry/utils/profiling/colors/utils';
import type {FlamegraphColorCodings} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {Frame} from 'sentry/utils/profiling/frame';
import {hexToColorChannels} from 'sentry/utils/profiling/gl/utils';
import {makeColorBucketTheme} from 'sentry/utils/profiling/speedscope';

const MONOSPACE_FONT = `ui-monospace, Menlo, Monaco, 'Cascadia Mono', 'Segoe UI Mono', 'Roboto Mono',
'Oxygen Mono', 'Ubuntu Monospace', 'Source Code Pro', 'Fira Mono', 'Droid Sans Mono',
'Courier New', monospace`;

// Luma chroma settings
export interface LCH {
  C_0: number;
  C_d: number;
  L_0: number;
  L_d: number;
}
// Color can be rgb or rgba. I want to probably eliminate rgb and just use rgba, but we would be allocating 25% more memory,
// and I'm not sure about the impact we'd need. There is a tradeoff between memory and runtime performance checks that I'll need to evaluate at some point.
export type ColorChannels = [number, number, number] | [number, number, number, number];

export type ColorMapFn = (
  frames: readonly FlamegraphFrame[],
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET'],
  theme: FlamegraphTheme,
  sortByKey?: (a: FlamegraphFrame, b: FlamegraphFrame) => number
) => Map<FlamegraphFrame['frame']['key'], ColorChannels>;

export interface FlamegraphTheme {
  // @TODO, most colors are defined as strings, which is a mistake as we loose a lot of functionality and impose constraints.
  // They should instead be defined as arrays of numbers so we can use them with glsl and avoid unnecessary parsing
  COLORS: {
    BAR_LABEL_FONT_COLOR: string;
    BATTERY_CHART_COLORS: ColorChannels[];
    CHART_CURSOR_INDICATOR: string;
    CHART_LABEL_COLOR: string;
    COLOR_BUCKET: (t: number) => ColorChannels;
    COLOR_MAPS: Record<FlamegraphColorCodings[number], ColorMapFn>;
    CPU_CHART_COLORS: ColorChannels[];
    CURSOR_CROSSHAIR: string;
    DIFFERENTIAL_DECREASE: ColorChannels;
    DIFFERENTIAL_INCREASE: ColorChannels;
    FOCUSED_FRAME_BORDER_COLOR: string;
    FRAME_APPLICATION_COLOR: ColorChannels;
    FRAME_FALLBACK_COLOR: ColorChannels;
    FRAME_SYSTEM_COLOR: ColorChannels;
    GRID_FRAME_BACKGROUND_COLOR: string;
    GRID_LINE_COLOR: string;
    HIGHLIGHTED_LABEL_COLOR: string;
    HOVERED_FRAME_BORDER_COLOR: string;
    LABEL_FONT_COLOR: string;
    MEMORY_CHART_COLORS: ColorChannels[];
    MINIMAP_POSITION_OVERLAY_BORDER_COLOR: string;
    MINIMAP_POSITION_OVERLAY_COLOR: string;
    // Nice color picker for GLSL colors - https://keiwando.com/color-picker/
    SAMPLE_TICK_COLOR: ColorChannels;
    SEARCH_RESULT_FRAME_COLOR: string;
    SEARCH_RESULT_SPAN_COLOR: string;
    SELECTED_FRAME_BORDER_COLOR: string;
    SPAN_COLOR_BUCKET: (t: number) => ColorChannels;
    SPAN_FALLBACK_COLOR: [number, number, number, number];
    SPAN_FRAME_BORDER: string;
    SPAN_FRAME_LINE_PATTERN: string;
    SPAN_FRAME_LINE_PATTERN_BACKGROUND: string;
    STACK_TO_COLOR: (
      frames: readonly FlamegraphFrame[],
      colorMapFn: ColorMapFn,
      colorBucketFn: FlamegraphTheme['COLORS']['COLOR_BUCKET'],
      theme: FlamegraphTheme
    ) => {
      colorBuffer: number[];
      colorMap: Map<Frame['key'], ColorChannels>;
    };
    UI_FRAME_COLOR_FROZEN: ColorChannels;
    UI_FRAME_COLOR_SLOW: ColorChannels;
  };
  FONTS: {
    FONT: string;
    FRAME_FONT: string;
  };
  LCH: LCH;
  SIZES: {
    AGGREGATE_FLAMEGRAPH_DEPTH_OFFSET: number;
    BAR_FONT_SIZE: number;
    BAR_HEIGHT: number;
    BAR_PADDING: number;
    BATTERY_CHART_HEIGHT: number;
    CHART_PX_PADDING: number;
    CPU_CHART_HEIGHT: number;
    FLAMEGRAPH_DEPTH_OFFSET: number;
    GRID_LINE_WIDTH: number;
    HIGHLIGHTED_FRAME_BORDER_WIDTH: any;
    HOVERED_FRAME_BORDER_WIDTH: number;
    INTERNAL_SAMPLE_TICK_LINE_WIDTH: number;
    LABEL_FONT_PADDING: number;
    LABEL_FONT_SIZE: number;
    MAX_SPANS_HEIGHT: number;
    MEMORY_CHART_HEIGHT: number;
    METRICS_FONT_SIZE: number;
    MINIMAP_HEIGHT: number;
    MINIMAP_POSITION_OVERLAY_BORDER_WIDTH: number;
    SPANS_BAR_HEIGHT: number;
    SPANS_DEPTH_OFFSET: number;
    SPANS_FONT_SIZE: number;
    TIMELINE_HEIGHT: number;
    TIMELINE_LABEL_HEIGHT: number;
    TOOLTIP_FONT_SIZE: number;
    UI_FRAMES_HEIGHT: number;
  };
}

const SIZES: FlamegraphTheme['SIZES'] = {
  AGGREGATE_FLAMEGRAPH_DEPTH_OFFSET: 4,
  BAR_FONT_SIZE: 11,
  BAR_HEIGHT: 20,
  BAR_PADDING: 4,
  BATTERY_CHART_HEIGHT: 80,
  FLAMEGRAPH_DEPTH_OFFSET: 12,
  HOVERED_FRAME_BORDER_WIDTH: 2,
  HIGHLIGHTED_FRAME_BORDER_WIDTH: 3,
  GRID_LINE_WIDTH: 2,
  INTERNAL_SAMPLE_TICK_LINE_WIDTH: 1,
  LABEL_FONT_PADDING: 6,
  LABEL_FONT_SIZE: 10,
  MINIMAP_HEIGHT: 100,
  CPU_CHART_HEIGHT: 80,
  MEMORY_CHART_HEIGHT: 80,
  MINIMAP_POSITION_OVERLAY_BORDER_WIDTH: 2,
  SPANS_BAR_HEIGHT: 20,
  SPANS_DEPTH_OFFSET: 3,
  SPANS_FONT_SIZE: 11,
  METRICS_FONT_SIZE: 9,
  MAX_SPANS_HEIGHT: 160,
  TIMELINE_HEIGHT: 20,
  TOOLTIP_FONT_SIZE: 12,
  TIMELINE_LABEL_HEIGHT: 20,
  UI_FRAMES_HEIGHT: 60,
  CHART_PX_PADDING: 30,
};

function makeFlamegraphFonts(theme: Theme): FlamegraphTheme['FONTS'] {
  return {
    FONT: MONOSPACE_FONT,
    FRAME_FONT: theme.text.familyMono,
  };
}

const LCH_LIGHT = {
  C_0: 0.35,
  C_d: 0.3,
  L_0: 0.8,
  L_d: 0.15,
};

const SPAN_LCH_LIGHT = {
  C_0: 0.3,
  C_d: 0.25,
  L_0: 0.8,
  L_d: 0.15,
};

export const makeLightFlamegraphTheme = (theme: Theme): FlamegraphTheme => {
  const chartColors = theme.chart.getColorPalette(12);

  return {
    LCH: LCH_LIGHT,
    SIZES: {
      ...SIZES,
      TIMELINE_LABEL_HEIGHT: 26,
    },
    FONTS: makeFlamegraphFonts(theme),
    COLORS: {
      COLOR_BUCKET: makeColorBucketTheme(LCH_LIGHT),
      SPAN_COLOR_BUCKET: makeColorBucketTheme(SPAN_LCH_LIGHT, 140, 220),
      COLOR_MAPS: {
        'by symbol name': makeColorMapBySymbolName,
        'by system frame': makeColorMapBySystemFrame,
        'by application frame': makeColorMapByApplicationFrame,
        'by library': makeColorMapByLibrary,
        'by recursion': makeColorMapByRecursion,
        'by frequency': makeColorMapByFrequency,
        'by system vs application frame': makeColorMapBySystemVsApplicationFrame,
      },

      // Charts
      CPU_CHART_COLORS: chartColors.map(c => hexToColorChannels(c, 0.8)),
      MEMORY_CHART_COLORS: [
        hexToColorChannels(theme.colors.yellow400, 1),
        hexToColorChannels(theme.colors.red400, 1),
      ],
      UI_FRAME_COLOR_SLOW: hexToColorChannels(theme.colors.yellow300, 1),
      UI_FRAME_COLOR_FROZEN: hexToColorChannels(theme.colors.red400, 1),
      BATTERY_CHART_COLORS: [hexToColorChannels(theme.colors.blue400, 1)],

      // Preset colors
      FRAME_APPLICATION_COLOR: hexToColorChannels(theme.colors.blue400, 0.4),
      FRAME_SYSTEM_COLOR: hexToColorChannels(theme.colors.red400, 0.3),
      DIFFERENTIAL_DECREASE: hexToColorChannels(theme.colors.blue400, 0.6),
      DIFFERENTIAL_INCREASE: hexToColorChannels(theme.colors.red400, 0.4),
      SAMPLE_TICK_COLOR: hexToColorChannels(theme.colors.red400, 0.5),

      // Cursors and labels
      LABEL_FONT_COLOR: theme.tokens.content.primary,
      BAR_LABEL_FONT_COLOR: theme.tokens.content.primary,
      CHART_CURSOR_INDICATOR: theme.subText,
      CHART_LABEL_COLOR: theme.subText,
      CURSOR_CROSSHAIR: theme.tokens.border.primary,

      // Special states
      FOCUSED_FRAME_BORDER_COLOR: theme.tokens.focus.default,
      HIGHLIGHTED_LABEL_COLOR: `rgba(240, 240, 0, 1)`,
      HOVERED_FRAME_BORDER_COLOR: theme.colors.gray400,
      SELECTED_FRAME_BORDER_COLOR: theme.colors.blue500,

      // Search results
      SEARCH_RESULT_FRAME_COLOR: 'vec4(0.99, 0.70, 0.35, 1.0)',
      SEARCH_RESULT_SPAN_COLOR: '#fdb359',

      // Patterns
      SPAN_FRAME_LINE_PATTERN_BACKGROUND: theme.colors.gray100,
      SPAN_FRAME_LINE_PATTERN: theme.colors.gray200,

      // Fallbacks
      SPAN_FALLBACK_COLOR: [0, 0, 0, 0.1],
      FRAME_FALLBACK_COLOR: [0.5, 0.5, 0.6, 0.1],

      // Layout colors
      GRID_LINE_COLOR: theme.colors.surface200,
      GRID_FRAME_BACKGROUND_COLOR: theme.colors.surface400,

      MINIMAP_POSITION_OVERLAY_BORDER_COLOR: theme.colors.gray300,
      MINIMAP_POSITION_OVERLAY_COLOR: theme.colors.gray200,

      SPAN_FRAME_BORDER: theme.colors.gray300,
      STACK_TO_COLOR: makeStackToColor([0, 0, 0, 0.035]),
    },
  };
};

const LCH_DARK = {
  C_0: 0.35,
  C_d: 0.25,
  L_0: 0.25,
  L_d: 0.15,
};

const SPANS_LCH_DARK = {
  C_0: 0.4,
  C_d: 0.25,
  L_0: 0.3,
  L_d: 0.2,
};

export const makeDarkFlamegraphTheme = (theme: Theme): FlamegraphTheme => {
  const chartColors = theme.chart.getColorPalette(12);
  return {
    LCH: LCH_DARK,
    SIZES: {
      ...SIZES,
      TIMELINE_LABEL_HEIGHT: 26,
    },
    FONTS: makeFlamegraphFonts(theme),
    COLORS: {
      COLOR_BUCKET: makeColorBucketTheme(LCH_DARK),
      SPAN_COLOR_BUCKET: makeColorBucketTheme(SPANS_LCH_DARK, 140, 220),
      COLOR_MAPS: {
        'by symbol name': makeColorMapBySymbolName,
        'by system frame': makeColorMapBySystemFrame,
        'by application frame': makeColorMapByApplicationFrame,
        'by library': makeColorMapByLibrary,
        'by recursion': makeColorMapByRecursion,
        'by frequency': makeColorMapByFrequency,
        'by system vs application frame': makeColorMapBySystemVsApplicationFrame,
      },

      // Charts
      CPU_CHART_COLORS: chartColors.map(c => hexToColorChannels(c, 0.8)),
      MEMORY_CHART_COLORS: [
        hexToColorChannels(theme.colors.yellow400, 1),
        hexToColorChannels(theme.colors.red400, 1),
      ],
      UI_FRAME_COLOR_SLOW: hexToColorChannels(theme.colors.yellow300, 1),
      UI_FRAME_COLOR_FROZEN: hexToColorChannels(theme.colors.red400, 1),
      BATTERY_CHART_COLORS: [hexToColorChannels(theme.colors.blue400, 1)],

      // Preset colors
      FRAME_APPLICATION_COLOR: hexToColorChannels(theme.colors.blue400, 0.6),
      FRAME_SYSTEM_COLOR: hexToColorChannels(theme.colors.red400, 0.5),
      DIFFERENTIAL_DECREASE: hexToColorChannels(theme.colors.blue400, 0.6),
      DIFFERENTIAL_INCREASE: hexToColorChannels(theme.colors.red400, 0.4),
      SAMPLE_TICK_COLOR: hexToColorChannels(theme.colors.red400, 0.5),

      // Cursors and labels
      LABEL_FONT_COLOR: theme.tokens.content.primary,
      BAR_LABEL_FONT_COLOR: theme.tokens.content.primary,
      CHART_CURSOR_INDICATOR: theme.subText,
      CHART_LABEL_COLOR: theme.subText,
      CURSOR_CROSSHAIR: theme.tokens.border.primary,

      // Special states
      FOCUSED_FRAME_BORDER_COLOR: theme.tokens.focus.default,
      HIGHLIGHTED_LABEL_COLOR: theme.colors.yellow400,
      HOVERED_FRAME_BORDER_COLOR: theme.colors.gray400,
      SELECTED_FRAME_BORDER_COLOR: theme.colors.blue500,

      // Search results
      SEARCH_RESULT_FRAME_COLOR: 'vec4(0.99, 0.70, 0.35, 1.0)',
      SEARCH_RESULT_SPAN_COLOR: '#fdb359',

      // Patterns
      SPAN_FRAME_LINE_PATTERN: theme.colors.gray200,
      SPAN_FRAME_LINE_PATTERN_BACKGROUND: theme.colors.gray100,

      // Fallbacks
      FRAME_FALLBACK_COLOR: [0.5, 0.5, 0.5, 0.4],
      SPAN_FALLBACK_COLOR: [1, 1, 1, 0.3],

      // Layout colors
      GRID_LINE_COLOR: theme.colors.surface200,
      GRID_FRAME_BACKGROUND_COLOR: theme.colors.surface400,
      MINIMAP_POSITION_OVERLAY_BORDER_COLOR: theme.colors.gray300,
      MINIMAP_POSITION_OVERLAY_COLOR: theme.colors.gray200,

      SPAN_FRAME_BORDER: theme.colors.gray300,
      STACK_TO_COLOR: makeStackToColor([1, 1, 1, 0.18]),
    },
  };
};
