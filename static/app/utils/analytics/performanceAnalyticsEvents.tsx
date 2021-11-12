import {PlatformKey} from 'app/data/platformCategories';

type SampleTransactionParam = {
  platform?: PlatformKey;
};

type PerformanceTourParams = {
  step: number;
  duration: number;
};

export type PerformanceEventParameters = {
  'performance_views.create_sample_transaction': SampleTransactionParam;
  'performance_views.tour.start': {};
  'performance_views.tour.advance': PerformanceTourParams;
  'performance_views.tour.close': PerformanceTourParams;
  'performance_views.landingv2.transactions.sort': {
    field?: string;
    direction?: string;
  };
  'performance_views.landingv3.widget.interaction': {
    widget_type?: string;
  };
  'performance_views.landingv3.widget.switch': {
    from_widget?: string;
    to_widget?: string;
    from_default?: boolean;
  };
  'performance_views.overview.navigate.summary': {};
  'performance_views.overview.cellaction': {action?: string};
};

export type PerformanceEventKey = keyof PerformanceEventParameters;

export const performanceEventMap: Record<PerformanceEventKey, string | null> = {
  'performance_views.create_sample_transaction': 'Growth: Performance Sample Transaction',
  'performance_views.tour.start': 'Performance Views: Tour Start',
  'performance_views.tour.advance': 'Performance Views: Tour Advance',
  'performance_views.tour.close': 'Performance Views: Tour Close',
  'performance_views.landingv2.transactions.sort':
    'Performance Views: Landing Transactions Sorted',
  'performance_views.overview.navigate.summary':
    'Performance Views: Overview view summary',
  'performance_views.overview.cellaction': 'Performance Views: Cell Action Clicked',
  'performance_views.landingv3.widget.interaction':
    'Performance Views: Landing Widget Interaction',
  'performance_views.landingv3.widget.switch':
    'Performance Views: Landing Widget Switched',
};
