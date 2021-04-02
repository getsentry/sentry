import {MinimalProject} from 'app/types';

export type UsageStat = {
  ts: string;
  date: string;
  total: number;
  accepted: number;
  filtered: number;
  dropped: {
    total: number;
    other?: number;
  };
};

export type OrganizationUsageStats = {
  statsErrors: UsageStat[];
  statsTransactions: UsageStat[];
  statsAttachments: UsageStat[];
};

export type ProjectUsageStats = MinimalProject & OrganizationUsageStats;
