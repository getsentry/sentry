import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Badge} from '@sentry/scraps/badge';
import {Text} from '@sentry/scraps/text';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Container, Flex} from 'sentry/components/core/layout';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconChevron, IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import withSubscription from 'getsentry/components/withSubscription';
import {RESERVED_BUDGET_QUOTA, UNLIMITED, UNLIMITED_ONDEMAND} from 'getsentry/constants';
import type {
  BillingHistory,
  BillingMetricHistory,
  Plan,
  Subscription,
} from 'getsentry/types';
import {OnDemandBudgetMode} from 'getsentry/types';
import {
  convertUsageToReservedUnit,
  displayBudgetName,
  formatReservedWithUnits,
  formatUsageWithUnits,
  getSoftCapType,
  hasNewBillingUI,
} from 'getsentry/utils/billing';
import {getPlanCategoryName, sortCategories} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

import {StripedTable} from './styles';
import SubscriptionHeader from './subscriptionHeader';

interface Props extends RouteComponentProps<unknown, unknown> {
  subscription: Subscription;
}

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
  hadCustomDynamicSampling?: boolean;
  plan?: Plan;
};

function getCategoryDisplay({
  plan,
  metricHistory,
  hadCustomDynamicSampling,
}: DisplayProps): React.ReactNode {
  const displayName = getPlanCategoryName({
    plan,
    category: metricHistory.category,
    hadCustomDynamicSampling,
  });
  const softCapName = getSoftCapType(metricHistory);
  return softCapName
    ? tct('[displayName] ([softCapName])', {displayName, softCapName})
    : displayName;
}

function UsageHistory({subscription}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const isNewBillingUI = hasNewBillingUI(organization);

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

  const usageListPageLinks = getResponseHeader?.('Link');
  const hasBillingPerms = organization.access?.includes('org:billing');

  if (!isNewBillingUI) {
    if (isPending) {
      return (
        <SubscriptionPageContainer background="primary" organization={organization}>
          <SubscriptionHeader subscription={subscription} organization={organization} />
          <LoadingIndicator />
        </SubscriptionPageContainer>
      );
    }

    if (isError) {
      return (
        <SubscriptionPageContainer background="primary" organization={organization}>
          <LoadingError onRetry={refetch} />
        </SubscriptionPageContainer>
      );
    }

    if (!hasBillingPerms) {
      return (
        <SubscriptionPageContainer background="primary" organization={organization}>
          <ContactBillingMembers />
        </SubscriptionPageContainer>
      );
    }

    return (
      <SubscriptionPageContainer background="primary" organization={organization}>
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
      </SubscriptionPageContainer>
    );
  }

  return (
    <SubscriptionPageContainer background="primary" organization={organization}>
      <SentryDocumentTitle title={t('Usage History')} orgSlug={organization.slug} />
      <SettingsPageHeader title={t('Usage History')} />
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError onRetry={refetch} />
      ) : hasBillingPerms ? (
        <Fragment>
          <Container background="primary" border="primary" radius="md">
            {usageList.map(row => (
              <UsageHistoryRow key={row.id} history={row} subscription={subscription} />
            ))}
          </Container>
          {usageListPageLinks && <Pagination pageLinks={usageListPageLinks} />}
        </Fragment>
      ) : (
        <ContactBillingMembers />
      )}
    </SubscriptionPageContainer>
  );
}

type RowProps = {
  history: BillingHistory;
  subscription: Subscription;
};

function UsageHistoryRow({history}: RowProps) {
  const organization = useOrganization();
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
              {tct('[budgetTerm] Spend[suffix]', {
                budgetTerm: displayBudgetName(history.planDetails, {title: true}),
                suffix: history.planDetails?.hasOnDemandModes
                  ? history.onDemandBudgetMode === OnDemandBudgetMode.PER_CATEGORY
                    ? ' (Per-Category)'
                    : ' (Shared)'
                  : '',
              })}
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

  const hasGifts = Object.values(DataCategory).some(c => {
    return !!categories[c]?.free;
  });

  return (
    <StyledPanelItem>
      <Flex
        justify={{xs: 'start', md: 'between'}}
        direction={{xs: 'column', md: 'row'}}
        gap="xl"
      >
        <Flex gap="lg">
          <Button
            data-test-id="history-expand"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            icon={<IconChevron direction={expanded ? 'up' : 'down'} />}
            aria-label={t('Expand history')}
          />
          <Flex direction="column" gap="sm">
            <Flex gap="sm" align="center">
              <Text variant="muted">
                {moment(history.periodStart).format('ll')} -{' '}
                {moment(history.periodEnd).format('ll')}
              </Text>
              {history.isCurrent && <Badge variant="muted">{t('Current')}</Badge>}
            </Flex>
            <Text bold>{tct('[planName] Plan', {planName: history.planName})}</Text>
          </Flex>
        </Flex>
        <ButtonBar>
          <Button
            icon={<IconDownload />}
            onClick={() => {
              trackGetsentryAnalytics('subscription_page.download_reports.clicked', {
                organization,
                reportType: 'summary',
              });
              window.open(history.links.csv, '_blank');
            }}
          >
            {t('Download Summary')}
          </Button>
          <Button
            icon={<IconDownload />}
            onClick={() => {
              trackGetsentryAnalytics('subscription_page.download_reports.clicked', {
                organization,
                reportType: 'project_breakdown',
              });
              window.open(history.links.csvPerProject, '_blank');
            }}
          >
            {t('Download Project Breakdown')}
          </Button>
        </ButtonBar>
      </Flex>
      {expanded && (
        <Container padding="xl 0">
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
              {sortedCategories
                .filter(
                  metricHistory =>
                    metricHistory.category !== DataCategory.SPANS_INDEXED ||
                    (metricHistory.category === DataCategory.SPANS_INDEXED &&
                      history.hadCustomDynamicSampling)
                )
                .map(metricHistory => (
                  <tr key={metricHistory.category}>
                    <td>
                      {getCategoryDisplay({
                        plan: history.planDetails,
                        metricHistory,
                        hadCustomDynamicSampling: history.hadCustomDynamicSampling,
                      })}
                    </td>
                    <td>
                      {formatUsageWithUnits(metricHistory.usage, metricHistory.category, {
                        useUnitScaling:
                          metricHistory.category === DataCategory.ATTACHMENTS,
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
                      {metricHistory.reserved === RESERVED_BUDGET_QUOTA
                        ? 'N/A'
                        : usagePercentage(
                            convertUsageToReservedUnit(
                              metricHistory.usage,
                              metricHistory.category
                            ),
                            metricHistory.prepaid
                          )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </HistoryTable>
          {renderOnDemandUsage({sortedCategories})}
        </Container>
      )}
    </StyledPanelItem>
  );
}

export default withSubscription(UsageHistory);

const StyledPanelItem = styled(PanelItem)`
  flex-direction: column;
`;

const HistoryTable = styled(StripedTable)`
  table-layout: fixed;

  th,
  td {
    padding: ${p => p.theme.space.md};
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
