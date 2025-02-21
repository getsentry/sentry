import type {DataCategoryInfo} from 'sentry/types/core';

export interface SpikeDetails {
  dataCategory: DataCategoryInfo['name'];
  start: string;
  threshold: number;
  dropped?: number;
  duration?: number | null;
  end?: string;
}

export interface Spike {
  billingMetric: number;
  endDate: string;
  eventsDropped: number;
  id: string;
  initialThreshold: number;
  organizationId: number;
  projectId: number;
  startDate: string;
}

export interface SpikesList {
  end: string;
  groups: Array<{
    billing_metric: DataCategoryInfo['uid'];
    spikes: Spike[];
  }>;
  start: string;
}

export type SpikeThresholds = {
  end: string;
  groups: Array<{
    billing_metric: DataCategoryInfo['uid'];
    threshold: number[];
  }>;
  intervals: string[];
  start: string;
};
