export type LaravelInsightsEventParameters = {
  'laravel-insights.page-view': Record<string, unknown>;
  'laravel-insights.table_view_change': {
    view: string;
  };
};

export const laravelInsightsEventMap: Record<
  keyof LaravelInsightsEventParameters,
  string
> = {
  'laravel-insights.page-view': 'Laravel Insights: Page View',
  'laravel-insights.table_view_change': 'Laravel Insights: Table View Change',
};
