import {MinimalProject} from 'app/types';

export type RawStat = {
  quantity: number; // Counting for attachment size
  timesSeen: number; // Counting for errors or transactions
};

export type UsageStat = {
  ts: string;
  accepted: RawStat;
  filtered: RawStat;
  dropped: {
    overQuota?: RawStat;
    spikeProtection?: RawStat;
    other?: RawStat;
  };
};

export type OrganizationUsageStats = {
  statsErrors: UsageStat[];
  statsTransactions: UsageStat[];
  statsAttachments: UsageStat[];
};

export type ProjectUsageStats = MinimalProject & OrganizationUsageStats;
