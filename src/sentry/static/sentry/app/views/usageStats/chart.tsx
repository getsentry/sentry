import React from 'react';
import {withTheme} from 'emotion-theming';

import Panel from 'app/components/panels/panel';
import {Theme} from 'app/utils/theme';

// TODO(getsentry):
export type BillingStat = {
  ts: string;
  date: string;
  total: number;
  accepted: number;
  filtered: number;
  dropped: {
    total: number;
    overQuota?: number;
    spikeProtection?: number;
    other?: number; // Calculated in UsageDetailItem
  };
  projected?: boolean; // TODO(chart-cleanup): Used by v1 only
  isProjected?: boolean;
};
export type BillingStats = BillingStat[];

/**
 * WIP(leedongwei)
 */
type Props = {
  theme: Theme;

  hasTransactions: boolean;
  hasAttachments: boolean;
  usagePeriodStart: string;
  usagePeriodEnd: string;
  usagePeriodToday: string;

  // // Quotas
  // reservedAttachments: DetailedSubscription['reservedAttachments'];
  // reservedErrors: DetailedSubscription['reservedErrors'];
  // reservedEvents: DetailedSubscription['reservedEvents'];
  // reservedTransactions: DetailedSubscription['reservedTransactions'];

  // Stats
  statsAttachments: BillingStats;
  statsErrors: BillingStats;
  statsTransactions: BillingStats;
};

type State = {
  // WIP(leedongwei)
};

class ReservedUsageChart extends React.Component<Props, State> {
  render() {
    return <Panel id="usage-chart">UsageStatsOrganization Chart</Panel>;
  }
}

export default withTheme(ReservedUsageChart);
