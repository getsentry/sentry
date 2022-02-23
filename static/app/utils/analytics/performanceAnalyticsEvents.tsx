import {PlatformKey} from 'sentry/data/platformCategories';

type SampleTransactionParam = {
  platform?: PlatformKey;
};

type PerformanceTourParams = {
  duration: number;
  step: number;
};

export type PerformanceEventParameters = {
  'performance_views.create_sample_transaction': SampleTransactionParam;
  'performance_views.landingv2.transactions.sort': {
    direction?: string;
    field?: string;
  };
  'performance_views.landingv3.batch_queries': {
    num_collected: number;
    num_saved: number;
    num_sent: number;
  };
  'performance_views.landingv3.display_change': {
    change_to_display: string;
    current_display: string;
    default_display: string;
    is_default: boolean;
  };
  'performance_views.landingv3.widget.interaction': {
    widget_type?: string;
  };
  'performance_views.landingv3.widget.switch': {
    from_default?: boolean;
    from_widget?: string;
    to_widget?: string;
  };
  'performance_views.overview.cellaction': {action?: string};
  'performance_views.overview.navigate.summary': {};
  'performance_views.overview.search': {};
  'performance_views.overview.view': {
    show_onboarding: boolean;
  };
  'performance_views.spans.change_op': {
    operation_name?: string;
  };
  'performance_views.spans.change_sort': {
    sort_column?: string;
  };
  'performance_views.tour.advance': PerformanceTourParams;
  'performance_views.tour.close': PerformanceTourParams;
  'performance_views.tour.start': {};
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
  'performance_views.landingv3.batch_queries':
    'Performance Views: Landing Query Batching',
  'performance_views.landingv3.display_change': 'Performance Views: Switch Landing Tabs',
  'performance_views.spans.change_op': 'Performance Views: Change span operation name',
  'performance_views.spans.change_sort': 'Performance Views: Change span sort column',
  'performance_views.overview.view': 'Performance Views: Transaction overview view',
  'performance_views.overview.search': 'Performance Views: Transaction overview search',
};
