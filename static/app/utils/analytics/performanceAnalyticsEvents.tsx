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
};

export type PerformanceEventKey = keyof PerformanceEventParameters;

export const performanceEventMap: Record<PerformanceEventKey, string | null> = {
  'performance_views.create_sample_transaction': 'Growth: Performance Sample Transaction',
  'performance_views.tour.start': 'Performance Views: Tour Start',
  'performance_views.tour.advance': 'Performance Views: Tour Advance',
  'performance_views.tour.close': 'Performance Views: Tour Close',
};
