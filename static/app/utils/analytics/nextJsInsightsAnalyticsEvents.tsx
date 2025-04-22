type NextJsInsightsEventParameters = {
  'nextjs-insights.page-view': Record<string, unknown>;
  'nextjs-insights.ui_toggle': {
    isEnabled: boolean;
  };
};

export const nextJsInsightsEventMap: Record<keyof NextJsInsightsEventParameters, string> =
  {
    'nextjs-insights.page-view': 'NextJS Insights: Page View',
    'nextjs-insights.ui_toggle': 'NextJS Insights: UI Toggle',
  };
