export type LaravelInsightsEventParameters = {
  'laravel-insights.ui_toggle': {
    isEnabled: boolean;
  };
};

export const laravelInsightsEventMap: Record<
  keyof LaravelInsightsEventParameters,
  string
> = {
  'laravel-insights.ui_toggle': 'Laravel Insights: UI Toggle',
};
