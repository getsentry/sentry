import {makeColorBucketTheme, makeColorMap, makeStackToColor} from './../colors/utils';
import {Frame} from './../frame';

const MONOSPACE_FONT = `ui-monospace, Menlo, Monaco, 'Cascadia Mono', 'Segoe UI Mono', 'Roboto Mono',
'Oxygen Mono', 'Ubuntu Monospace', 'Source Code Pro', 'Fira Mono', 'Droid Sans Mono',
'Courier New', monospace`;

const FRAME_FONT = `"Source Code Pro", Courier, monospace`;

// Luma chroma hue settings
export interface LCH {
  C_0: number;
  C_d: number;
  L_0: number;
  L_d: number;
}
// Color can be rgb or rgba. I want to probably eliminate rgb and just use rgba, but we would be allocating 25% more memory,
// and I'm not sure about the impact we'd need. There is a tradeoff between memory and runtime performance checks that I'll need to evaluate at some point.
export type ColorChannels = [number, number, number] | [number, number, number, number];

export interface FlamegraphTheme {
  // @TODO, most colors are defined as strings, which is a mistake as we loose a lot of functionality and impose constraints.
  // They should instead be defined as arrays of numbers so we can use them with glsl and avoid unnecessary parsing
  COLORS: {
    BAR_LABEL_FONT_COLOR: string;
    COLOR_BUCKET: (t: number, frame?: Frame) => ColorChannels;
    COLOR_MAP: (
      frames: ReadonlyArray<Frame>,
      colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET'],
      sortByKey?: (a: Frame, b: Frame) => number
    ) => Map<Frame['key'], ColorChannels>;
    CURSOR_CROSSHAIR: string;
    DIFFERENTIAL_DECREASE: ColorChannels;
    DIFFERENTIAL_INCREASE: ColorChannels;
    FRAME_FALLBACK_COLOR: [number, number, number, number];
    GRID_FRAME_BACKGROUND_COLOR: string;
    GRID_LINE_COLOR: string;
    HOVERED_FRAME_BORDER_COLOR: string;
    LABEL_FONT_COLOR: string;
    MINIMAP_POSITION_OVERLAY_BORDER_COLOR: string;
    MINIMAP_POSITION_OVERLAY_COLOR: string;
    REQUEST_2XX_RESPONSE: string;
    REQUEST_4XX_RESPONSE: string;

    REQUEST_DNS_TIME: string;
    REQUEST_SSL_TIME: string;
    REQUEST_TCP_TIME: string;
    // Nice color picker for GLSL colors - https://keiwando.com/color-picker/
    REQUEST_WAIT_TIME: string;
    SEARCH_RESULT_FRAME_COLOR: string;
    SELECTED_FRAME_BORDER_COLOR: string;
    SPAN_FRAME_BACKGROUND: string;
    SPAN_FRAME_BORDER: string;
    STACK_TO_COLOR: (
      frames: ReadonlyArray<Frame>,
      colorMapFn: FlamegraphTheme['COLORS']['COLOR_MAP'],
      colorBucketFn: FlamegraphTheme['COLORS']['COLOR_BUCKET']
    ) => {
      colorBuffer: Array<number>;
      colorMap: Map<Frame['key'], ColorChannels>;
    };
  };
  CONFIG: {
    HIGHLIGHT_RECURSION: boolean;
  };
  FONTS: {
    FONT: string;
    FRAME_FONT: string;
  };
  SIZES: {
    BAR_FONT_SIZE: number;
    BAR_HEIGHT: number;
    BAR_PADDING: number;
    FLAMEGRAPH_DEPTH_OFFSET: number;
    FRAME_BORDER_WIDTH: number;
    HOVERED_FRAME_BORDER_WIDTH: number;
    LABEL_FONT_PADDING: number;
    LABEL_FONT_SIZE: number;
    MINIMAP_HEIGHT: number;
    MINIMAP_POSITION_OVERLAY_BORDER_WIDTH: number;
    REQUEST_BAR_HEIGHT: number;
    REQUEST_DEPTH_OFFSET: number;
    REQUEST_FONT_SIZE: number;
    // Request
    REQUEST_TAIL_HEIGHT: number;

    // Spans
    SPANS_BAR_HEIGHT: number;
    SPANS_DEPTH_OFFSET: number;
    SPANS_FONT_SIZE: number;
    TIMELINE_HEIGHT: number;
    TOOLTIP_FONT_SIZE: number;
  };
}

// Luma chroma hue settings for light theme
export const LCH_LIGHT = {
  C_0: 0.25,
  C_d: 0.2,
  L_0: 0.8,
  L_d: 0.15,
};

// Luma chroma hue settings for dark theme
export const LCH_DARK = {
  C_0: 0.2,
  C_d: 0.1,
  L_0: 0.2,
  L_d: 0.1,
};

export const LightFlamegraphTheme: FlamegraphTheme = {
  CONFIG: {
    HIGHLIGHT_RECURSION: false,
  },
  SIZES: {
    BAR_HEIGHT: 20,
    BAR_FONT_SIZE: 12,
    BAR_PADDING: 4,
    FLAMEGRAPH_DEPTH_OFFSET: 12,
    SPANS_DEPTH_OFFSET: 4,
    SPANS_FONT_SIZE: 10,
    SPANS_BAR_HEIGHT: 14,
    REQUEST_TAIL_HEIGHT: 8,
    REQUEST_BAR_HEIGHT: 14,
    REQUEST_FONT_SIZE: 10,
    REQUEST_DEPTH_OFFSET: 4,
    MINIMAP_POSITION_OVERLAY_BORDER_WIDTH: 2,
    MINIMAP_HEIGHT: 100,
    TIMELINE_HEIGHT: 20,
    LABEL_FONT_SIZE: 10,
    LABEL_FONT_PADDING: 6,
    FRAME_BORDER_WIDTH: 2,
    HOVERED_FRAME_BORDER_WIDTH: 1,
    TOOLTIP_FONT_SIZE: 12,
  },
  COLORS: {
    LABEL_FONT_COLOR: '#1f233a',
    BAR_LABEL_FONT_COLOR: '#000',
    GRID_LINE_COLOR: '#e5e7eb',
    GRID_FRAME_BACKGROUND_COLOR: 'rgba(255, 255, 255, 0.8)',
    SEARCH_RESULT_FRAME_COLOR: 'vec4(0.99, 0.70, 0.35, 1.0)',
    SELECTED_FRAME_BORDER_COLOR: '#005aff',
    HOVERED_FRAME_BORDER_COLOR: 'rgba(0, 0, 0, 0.8)',
    CURSOR_CROSSHAIR: '#bbbbbb',
    SPAN_FRAME_BORDER: 'rgba(200, 200, 200, 1)',
    SPAN_FRAME_BACKGROUND: 'rgba(231, 231, 231, 0.5)',
    MINIMAP_POSITION_OVERLAY_COLOR: 'rgba(0,0,0,0.1)',
    MINIMAP_POSITION_OVERLAY_BORDER_COLOR: 'rgba(0,0,0, 0.2)',
    REQUEST_WAIT_TIME: `rgba(253,252,224, 1)`,
    REQUEST_DNS_TIME: `rgba(57, 146, 152, 1)`,
    REQUEST_TCP_TIME: `rgba(242, 146,57,1)`,
    REQUEST_SSL_TIME: `rgba(207,84,218, 1)`,
    REQUEST_2XX_RESPONSE: 'rgba(218, 231, 209, 1)',
    REQUEST_4XX_RESPONSE: 'rgba(255,96, 96, 1)',
    DIFFERENTIAL_INCREASE: [0.98, 0.2058, 0.4381],
    DIFFERENTIAL_DECREASE: [0.309, 0.2058, 0.98],
    COLOR_BUCKET: makeColorBucketTheme(LCH_LIGHT),
    COLOR_MAP: makeColorMap,
    STACK_TO_COLOR: makeStackToColor([0, 0, 0, 0.035]),
    FRAME_FALLBACK_COLOR: [0, 0, 0, 0.035],
  },
  FONTS: {
    FONT: MONOSPACE_FONT,
    FRAME_FONT,
  },
};

export const DarkFlamegraphTheme: FlamegraphTheme = {
  CONFIG: {
    HIGHLIGHT_RECURSION: false,
  },
  SIZES: {
    BAR_HEIGHT: 20,
    BAR_FONT_SIZE: 12,
    BAR_PADDING: 4,
    FLAMEGRAPH_DEPTH_OFFSET: 12,
    SPANS_DEPTH_OFFSET: 4,
    SPANS_FONT_SIZE: 10,
    SPANS_BAR_HEIGHT: 14,
    REQUEST_TAIL_HEIGHT: 8,
    REQUEST_BAR_HEIGHT: 14,
    REQUEST_FONT_SIZE: 10,
    REQUEST_DEPTH_OFFSET: 4,
    MINIMAP_POSITION_OVERLAY_BORDER_WIDTH: 2,
    MINIMAP_HEIGHT: 100,
    TIMELINE_HEIGHT: 20,
    LABEL_FONT_SIZE: 10,
    LABEL_FONT_PADDING: 6,
    FRAME_BORDER_WIDTH: 2,
    HOVERED_FRAME_BORDER_WIDTH: 1,
    TOOLTIP_FONT_SIZE: 12,
  },
  COLORS: {
    LABEL_FONT_COLOR: 'rgba(255, 255, 255, 0.8)',
    BAR_LABEL_FONT_COLOR: 'rgb(255 255 255 / 80%)',
    GRID_LINE_COLOR: '#222227',
    GRID_FRAME_BACKGROUND_COLOR: 'rgba(0, 0, 0, 0.4)',
    SEARCH_RESULT_FRAME_COLOR: 'vec4(0.99, 0.70, 0.35, 0.7)',
    SELECTED_FRAME_BORDER_COLOR: '#3482ea',
    HOVERED_FRAME_BORDER_COLOR: 'rgba(255, 255, 255, 0.8)',
    CURSOR_CROSSHAIR: '#828285',
    SPAN_FRAME_BORDER: '#57575b',
    SPAN_FRAME_BACKGROUND: 'rgba(232, 232, 232, 0.2)',
    REQUEST_WAIT_TIME: `rgba(253,252,224, 1)`,
    REQUEST_DNS_TIME: `rgba(57, 146, 152, 1)`,
    REQUEST_TCP_TIME: `rgba(242, 146,57,1)`,
    REQUEST_SSL_TIME: `rgba(207,84,218, 1)`,
    REQUEST_2XX_RESPONSE: 'rgba(218, 231, 209, 1)',
    REQUEST_4XX_RESPONSE: 'rgba(255,96, 96, 1)',
    MINIMAP_POSITION_OVERLAY_COLOR: 'rgba(255,255,255,0.1)',
    MINIMAP_POSITION_OVERLAY_BORDER_COLOR: 'rgba(255,255,255, 0.2)',
    DIFFERENTIAL_INCREASE: [0.98, 0.2058, 0.4381],
    DIFFERENTIAL_DECREASE: [0.309, 0.2058, 0.98],
    COLOR_BUCKET: makeColorBucketTheme(LCH_DARK),
    COLOR_MAP: makeColorMap,
    STACK_TO_COLOR: makeStackToColor([1, 1, 1, 0.1]),
    FRAME_FALLBACK_COLOR: [1, 1, 1, 0.1],
  },
  FONTS: {
    FONT: MONOSPACE_FONT,
    FRAME_FONT,
  },
};
