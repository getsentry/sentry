export type LaravelInsightsEventParameters = {
  'laravel-insights.page-view': Record<string, unknown>;
  'laravel-insights.ui_toggle': {
    isEnabled: boolean;
  };
};

export const laravelInsightsEventMap: Record<
  keyof LaravelInsightsEventParameters,
  string
> = {
  'laravel-insights.page-view': 'Laravel Insights: Page View',
  'laravel-insights.ui_toggle': 'Laravel Insights: UI Toggle',
};
