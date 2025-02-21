import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconChevron, IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import withOrganization from 'sentry/utils/withOrganization';

import withSubscription from 'getsentry/components/withSubscription';
import {GIGABYTE, UNLIMITED, UNLIMITED_ONDEMAND} from 'getsentry/constants';
import type {
  BillingHistory,
  BillingMetricHistory,
  Plan,
  Subscription,
} from 'getsentry/types';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import {
  formatReservedWithUnits,
  formatUsageWithUnits,
  getSoftCapType,
} from 'getsentry/utils/billing';
import {getPlanCategoryName, sortCategories} from 'getsentry/utils/dataCategory';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';

import {StripedTable} from './styles';
import SubscriptionHeader from './subscriptionHeader';
import {trackSubscriptionView} from './utils';

type Props = {
  organization: Organization;
  subscription: Subscription;
} & RouteComponentProps<{}, {}>;

function usagePercentage(usage: number, prepaid: number | null): string {
  if (prepaid === null || prepaid === 0) {
    return t('0%');
  }
  if (usage > prepaid) {
    return '>100%';
  }
  return formatPercentage(usage / prepaid, 0);
}

type DisplayProps = {
  metricHistory: BillingMetricHistory;
  plan?: Plan;
};

function getCategoryDisplay({plan, metricHistory}: DisplayProps): React.ReactNode {
  const displayName = getPlanCategoryName({plan, category: metricHistory.category});
  const softCapName = getSoftCapType(metricHistory);
  return softCapName
    ? tct('[displayName] ([softCapName])', {displayName, softCapName})
    : displayName;
}

function UsageHistory({organization, subscription}: Props) {
  const location = useLocation();

  useEffect(() => {
    trackSubscriptionView(organization, subscription, 'usage');
  }, [organization, subscription]);

  const {
    data: usageList,
    isPending,
    isError,
    refetch,
    getResponseHeader,
  } = useApiQuery<BillingHistory[]>(
    [
      `/customers/${organization.slug}/history/`,
      {
        query: {cursor: location.query.cursor},
      },
    ],
    {
      staleTime: 0,
    }
  );

  if (isPending) {
    return (
      <Fragment>
        <SubscriptionHeader subscription={subscription} organization={organization} />
        <LoadingIndicator />
      </Fragment>
    );
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const usageListPageLinks = getResponseHeader?.('Link');

  const hasBillingPerms = organization.access?.includes('org:billing');
  if (!hasBillingPerms) {
    return <ContactBillingMembers />;
  }

  return (
    <Fragment>
      <SubscriptionHeader subscription={subscription} organization={organization} />
      <Panel>
        <PanelHeader>{t('Usage History')}</PanelHeader>
        <PanelBody data-test-id="history-table">
          {usageList.map(row => (
            <UsageHistoryRow key={row.id} history={row} subscription={subscription} />
          ))}
        </PanelBody>
      </Panel>
      {usageListPageLinks && <Pagination pageLinks={usageListPageLinks} />}
    </Fragment>
  );
}

type RowProps = {
  history: BillingHistory;
  subscription: Subscription;
};

function UsageHistoryRow({history, subscription}: RowProps) {
  const [expanded, setExpanded] = useState<boolean>(history.isCurrent);

  function renderOnDemandUsage({
    sortedCategories,
  }: {
    sortedCategories: BillingMetricHistory[];
  }) {
    if (!history.onDemandMaxSpend) {
      return null;
    }

    const ondemandUsageItems: React.ReactNode[] = sortedCategories.map(metricHistory => {
      const onDemandBudget =
        history.onDemandBudgetMode === OnDemandBudgetMode.SHARED
          ? history.onDemandMaxSpend
          : metricHistory.onDemandBudget;

      return (
        <tr key={`ondemand-${metricHistory.category}`}>
          <td>{getCategoryDisplay({plan: history.planDetails, metricHistory})}</td>
          <td>{displayPriceWithCents({cents: metricHistory.onDemandSpendUsed})}</td>
          <td>
            {history.onDemandMaxSpend === UNLIMITED_ONDEMAND
              ? UNLIMITED
              : history.onDemandBudgetMode === OnDemandBudgetMode.SHARED
                ? '\u2014'
                : displayPriceWithCents({cents: onDemandBudget})}
          </td>
          <td>
            {history.onDemandMaxSpend === UNLIMITED_ONDEMAND || onDemandBudget === 0
              ? '0%'
              : formatPercentage(metricHistory.onDemandSpendUsed / onDemandBudget, 0)}
          </td>
        </tr>
      );
    });

    return (
      <HistoryTable key="ondemand">
        <thead>
          <tr>
            <th>
              {subscription.planTier === PlanTier.AM3
                ? t('Pay-as-you-go Spend')
                : history.onDemandBudgetMode === OnDemandBudgetMode.PER_CATEGORY
                  ? t('On-Demand Spend (Per-Category)')
                  : t('On-Demand Spend (Shared)')}
            </th>
            <th>{t('Amount Spent')}</th>
            <th>{t('Maximum')}</th>
            <th>{t('Used (%)')}</th>
          </tr>
        </thead>
        <tbody>
          {ondemandUsageItems}
          <tr>
            <td>{t('Total')}</td>
            <td>{displayPriceWithCents({cents: history.onDemandSpend})}</td>
            <td>
              {history.onDemandMaxSpend === UNLIMITED_ONDEMAND
                ? UNLIMITED
                : displayPriceWithCents({cents: history.onDemandMaxSpend})}
            </td>
            <td>
              {history.onDemandMaxSpend === UNLIMITED_ONDEMAND
                ? '0%'
                : formatPercentage(history.onDemandSpend / history.onDemandMaxSpend, 0)}
            </td>
          </tr>
        </tbody>
      </HistoryTable>
    );
  }

  const {categories} = history;

  // Only display categories with billing metric history
  const sortedCategories = sortCategories(categories);

  const hasGifts =
    Object.values(DataCategory).filter(c => {
      return !!categories[c]?.free;
    }).length > 0;

  return (
    <StyledPanelItem>
      <HistorySummary>
        <div>
          {moment(history.periodStart).format('ll')} ›{' '}
          {moment(history.periodEnd).format('ll')}
          <div>
            <small>
              {history.planName}
              {history.isCurrent && tct(' — [strong:Current]', {strong: <strong />})}
            </small>
          </div>
        </div>
        <ButtonBar gap={1}>
          <StyledDropdown>
            <DropdownMenu
              triggerProps={{
                size: 'sm',
                icon: <IconDownload />,
              }}
              triggerLabel={t('Reports')}
              items={[
                {
                  key: 'summary',
                  label: t('Summary'),
                  onAction: () => {
                    window.open(history.links.csv, '_blank');
                  },
                },
                {
                  key: 'project-breakdown',
                  label: t('Project Breakdown'),
                  onAction: () => {
                    window.open(history.links.csvPerProject, '_blank');
                  },
                },
              ]}
              position="bottom-end"
            />
          </StyledDropdown>
          <Button
            data-test-id="history-expand"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            icon={<IconChevron direction={expanded ? 'up' : 'down'} />}
            aria-label={t('Expand history')}
          />
        </ButtonBar>
      </HistorySummary>
      {expanded && (
        <HistoryDetails>
          <HistoryTable key="usage">
            <thead>
              <tr>
                <th>{t('Type')}</th>
                <th>{t('Accepted')}</th>
                <th>{t('Reserved')}</th>
                {hasGifts && <th>{t('Gifted')}</th>}
                <th>{t('Used (%)')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map(metricHistory => (
                <tr key={metricHistory.category}>
                  <td>
                    {getCategoryDisplay({plan: history.planDetails, metricHistory})}
                  </td>
                  <td>
                    {formatUsageWithUnits(metricHistory.usage, metricHistory.category, {
                      useUnitScaling: metricHistory.category === DataCategory.ATTACHMENTS,
                    })}
                  </td>
                  <td>
                    {formatReservedWithUnits(
                      metricHistory.reserved,
                      metricHistory.category
                    )}
                  </td>
                  {hasGifts && (
                    <td>
                      {formatReservedWithUnits(
                        metricHistory.free,
                        metricHistory.category,
                        {isGifted: true}
                      )}
                    </td>
                  )}
                  <td>
                    {usagePercentage(
                      metricHistory.category === DataCategory.ATTACHMENTS
                        ? metricHistory.usage / GIGABYTE
                        : metricHistory.usage,
                      metricHistory.prepaid
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </HistoryTable>
          {renderOnDemandUsage({sortedCategories})}
        </HistoryDetails>
      )}
    </StyledPanelItem>
  );
}

export default withOrganization(withSubscription(UsageHistory));

const StyledPanelItem = styled(PanelItem)`
  flex-direction: column;
`;

const HistorySummary = styled('div')`
  display: flex;
  justify-content: space-between;
  width: 100%;
`;

const HistoryDetails = styled('div')`
  padding: ${space(2)} 0;
`;

const HistoryTable = styled(StripedTable)`
  table-layout: fixed;

  th,
  td {
    padding: ${space(1)};
    text-align: right;
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
  th:first-child {
    padding-left: 0;
  }
`;

const StyledDropdown = styled('div')`
  display: inline-block;

  .dropdown-menu:after,
  .dropdown-menu:before {
    display: none;
  }
`;
