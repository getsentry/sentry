export type StarfishEventParameters = {
  'starfish.chart.zoom': {
    end: number;
    start: number;
    route?: string;
  };
  'starfish.pageview': {
    route: string;
  };
  'starfish.panel.open': {};
  'starfish.request': {
    duration: number;
    statusCode?: string;
  };
  'starfish.samples.loaded': {
    count: number;
  };
};

export type StarfishEventKey = keyof StarfishEventParameters;

export const starfishEventMap: Record<StarfishEventKey, string | null> = {
  'starfish.chart.zoom': 'Starfish: Chart Zoomed',
  'starfish.pageview': 'Starfish: Page Viewed',
  'starfish.panel.open': 'Starfish: Slide Over Panel Opened',
  'starfish.request': 'Starfish: API Request Completed',
  'starfish.samples.loaded': 'Starfish: Samples Loaded',
};
