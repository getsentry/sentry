type NextJsInsightsEventParameters = {
  'nextjs-insights.page-view': {
    view: string;
  };
  'nextjs-insights.table_view_change': {
    view: string;
  };
  'nextjs-insights.ui_toggle': {
    isEnabled: boolean;
  };
};

export const nextJsInsightsEventMap: Record<keyof NextJsInsightsEventParameters, string> =
  {
    'nextjs-insights.page-view': 'NextJS Insights: Page View',
    'nextjs-insights.table_view_change': 'NextJS Insights: Table View Change',
    'nextjs-insights.ui_toggle': 'NextJS Insights: UI Toggle',
  };
