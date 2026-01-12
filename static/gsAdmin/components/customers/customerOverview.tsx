import {Fragment} from 'react';
import styled from '@emotion/styled';
import upperFirst from 'lodash/upperFirst';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import ChangeARRAction from 'admin/components/changeARRAction';
import ChangeContractEndDateAction from 'admin/components/changeContractEndDateAction';
import CustomerContact from 'admin/components/customerContact';
import CustomerStatus from 'admin/components/customerStatus';
import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';
import {getLogQuery} from 'admin/utils';
import {BILLED_DATA_CATEGORY_INFO, UNLIMITED} from 'getsentry/constants';
import type {
  Plan,
  ReservedBudget,
  ReservedBudgetMetricHistory,
  Subscription,
} from 'getsentry/types';
import {AddOnCategory, BillingType, OnDemandBudgetMode} from 'getsentry/types';
import {
  displayBudgetName,
  formatBalance,
  formatReservedWithUnits,
  getActiveProductTrial,
  getBilledCategory,
  getProductTrial,
  RETENTION_SETTINGS_CATEGORIES,
} from 'getsentry/utils/billing';
import {
  getPlanCategoryName,
  getReservedBudgetDisplayName,
  sortCategories,
} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {getCountryByCode} from 'getsentry/utils/ISO3166codes';
import titleCase from 'getsentry/utils/titleCase';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

type SubscriptionSummaryProps = {
  customer: Subscription;
  onAction: (data: any) => void;
};

function SoftCapTypeDetail({
  categories,
  plan,
}: {
  categories: Subscription['categories'];
  plan: Plan;
}) {
  if (!categories) {
    return <span>None</span>;
  }
  const shouldUseDsNames = plan.categories.includes(DataCategory.SPANS_INDEXED);
  const softCapTypes = sortCategories(categories)
    .map(categoryHistory => {
      const softCapName = categoryHistory.softCapType
        ? titleCase(categoryHistory.softCapType.replace(/_/g, ' '))
        : null;
      if (softCapName) {
        return (
          <Fragment key={`test-soft-cap-type-${categoryHistory.category}`}>
            <small>
              {`${getPlanCategoryName({
                plan,
                category: categoryHistory.category,
                capitalize: true,
                hadCustomDynamicSampling: shouldUseDsNames,
              })}: `}
              {`${softCapName}`}
            </small>
            <br />
          </Fragment>
        );
      }
      return null;
    })
    .filter(i => i);
  return <Fragment>{softCapTypes.length ? softCapTypes : <span>None</span>}</Fragment>;
}

function SubscriptionSummary({customer, onAction}: SubscriptionSummaryProps) {
  return (
    <div>
      <DetailList>
        <DetailLabel title="Balance">
          {formatBalance(customer.accountBalance)}
          {customer.type === BillingType.INVOICED && (
            <Fragment>
              <br />
              <small>
                Note: this is an invoiced account, please send any questions about this
                balance to <a href="mailto:salesops@sentry.io">salesops@sentry.io</a>
              </small>
            </Fragment>
          )}
        </DetailLabel>
        <DetailLabel title="Billing Period">
          {`${moment(customer.billingPeriodStart).format('ll')} › ${moment(
            customer.billingPeriodEnd
          ).format('ll')}`}
          <br />
          <small>{customer.billingInterval}</small>
        </DetailLabel>
        {customer.contractPeriodStart && (
          <DetailLabel title="Contract Period">
            {`${moment(customer.contractPeriodStart).format('ll')} › `}
            {(customer.contractInterval === 'annual' &&
              customer.type === BillingType.INVOICED && (
                <ChangeContractEndDateAction
                  contractPeriodEnd={customer.contractPeriodEnd}
                  onAction={onAction}
                />
              )) ||
              `${moment(customer.contractPeriodEnd).format('ll')}`}

            <br />
            <small>{customer.contractInterval}</small>
          </DetailLabel>
        )}
        {/* TODO(billing): Should we start calling On-Demand periods "Pay-as-you-go" periods? */}
        <DetailLabel title="On-Demand">
          <OnDemandSummary customer={customer} />
        </DetailLabel>
        <DetailLabel title="Can Trial" yesNo={customer.canTrial} />
        <DetailLabel title="Legacy Soft Cap" yesNo={customer.hasSoftCap} />
        {customer.hasSoftCap && (
          <DetailLabel
            title="Overage Notifications Disabled"
            yesNo={customer.hasOverageNotificationsDisabled}
          />
        )}
        <DetailLabel title="Soft Cap By Category">
          <SoftCapTypeDetail
            categories={customer.categories}
            plan={customer.planDetails}
          />
        </DetailLabel>
        {defined(customer.msaUpdatedForDataConsent) && (
          <DetailLabel
            title="MSA Updated for Data Consent"
            yesNo={customer.msaUpdatedForDataConsent}
          />
        )}
      </DetailList>
    </div>
  );
}

type ReservedDataProps = {
  customer: Subscription;
};

function ReservedData({customer}: ReservedDataProps) {
  const reservedBudgetMetricHistories: Record<string, ReservedBudgetMetricHistory> = {};
  customer.reservedBudgets?.forEach(budget => {
    Object.entries(budget.categories).forEach(([category, history]) => {
      reservedBudgetMetricHistories[category] = history;
    });
  });

  return (
    <Fragment>
      {sortCategories(customer.categories).map(categoryHistory => {
        const category = categoryHistory.category;
        const categoryName = getPlanCategoryName({
          plan: customer.planDetails,
          category: categoryHistory.category,
          hadCustomDynamicSampling:
            category === DataCategory.SPANS &&
            DataCategory.SPANS_INDEXED in customer.categories,
        });
        return (
          <Fragment key={category}>
            <h6>{categoryName}</h6>
            <DetailList>
              <DetailLabel title={`Reserved ${categoryName}`}>
                {formatReservedWithUnits(categoryHistory.reserved, category)}
              </DetailLabel>
              {reservedBudgetMetricHistories[category] && (
                <Fragment>
                  <DetailLabel title={`Reserved Cost-Per-Event ${categoryName}`}>
                    {displayPriceWithCents({
                      cents: reservedBudgetMetricHistories[category].reservedCpe,
                      minimumFractionDigits: 8,
                      maximumFractionDigits: 8,
                    })}
                  </DetailLabel>
                  <DetailLabel title={`Reserved Spend ${categoryName}`}>
                    {displayPriceWithCents({
                      cents: reservedBudgetMetricHistories[category].reservedSpend,
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </DetailLabel>
                </Fragment>
              )}
              <DetailLabel title={`Custom Price ${categoryName}`}>
                {typeof categoryHistory.customPrice === 'number'
                  ? displayPriceWithCents({cents: categoryHistory.customPrice})
                  : 'None'}
              </DetailLabel>
              {customer.onDemandInvoicedManual && (
                <DetailLabel
                  title={`${displayBudgetName(customer.planDetails, {title: true})} Cost-Per-Event ${categoryName}`}
                >
                  {typeof categoryHistory.paygCpe === 'number'
                    ? displayPriceWithCents({
                        cents: categoryHistory.paygCpe,
                        minimumFractionDigits: 8,
                        maximumFractionDigits: 8,
                      })
                    : 'None'}
                </DetailLabel>
              )}
              {
                <DetailLabel title={`Gifted ${categoryName}`}>
                  {formatReservedWithUnits(categoryHistory.free, category, {
                    isGifted: true,
                  })}
                </DetailLabel>
              }
            </DetailList>
          </Fragment>
        );
      })}
    </Fragment>
  );
}

function ReservedBudgetsData({customer}: ReservedDataProps) {
  if (!customer.reservedBudgets) {
    return null;
  }

  return (
    <Fragment>
      {customer.reservedBudgets.map(reservedBudget => {
        return (
          <Fragment key={reservedBudget.id}>
            <ReservedBudgetData customer={customer} reservedBudget={reservedBudget} />
          </Fragment>
        );
      })}
    </Fragment>
  );
}

function ReservedBudgetData({
  customer,
  reservedBudget,
}: {
  customer: Subscription;
  reservedBudget: ReservedBudget;
}) {
  const budgetName = getReservedBudgetDisplayName({
    reservedBudget,
    shouldTitleCase: true,
    plan: customer.planDetails,
    hadCustomDynamicSampling: customer.hadCustomDynamicSampling,
  });

  return (
    <Fragment>
      <h6>{budgetName}</h6>
      <DetailList>
        <DetailLabel title="Reserved Budget">
          {displayPriceWithCents({cents: reservedBudget.reservedBudget})}
        </DetailLabel>
        <DetailLabel title="Gifted Budget">
          {displayPriceWithCents({cents: reservedBudget.freeBudget})}
        </DetailLabel>
        <DetailLabel title="Total Used">
          {displayPriceWithCents({cents: reservedBudget.totalReservedSpend})} /{' '}
          {displayPriceWithCents({
            cents: reservedBudget.reservedBudget + reservedBudget.freeBudget,
          })}{' '}
          ({(reservedBudget.percentUsed * 100).toFixed(2)}%)
        </DetailLabel>
      </DetailList>
    </Fragment>
  );
}

type OnDemandSummaryProps = {
  customer: Subscription;
};

function OnDemandSummary({customer}: OnDemandSummaryProps) {
  const onDemandPeriod = `${moment(customer.onDemandPeriodStart).format('ll')} › ${moment(
    customer.onDemandPeriodEnd
  ).format('ll')}`;

  if (
    customer.supportsOnDemand &&
    (customer.onDemandMaxSpend || customer.onDemandSpendUsed)
  ) {
    const {onDemandBudgets} = customer;

    if (
      onDemandBudgets &&
      onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY
    ) {
      return (
        <Fragment>
          {onDemandPeriod}
          <br />
          <small>
            <em>Per-category budget strategy</em>
          </small>
          <br />
          {customer.planDetails.onDemandCategories.map(category => {
            return (
              <Fragment key={`test-ondemand-${category}`}>
                <small>
                  {`${getPlanCategoryName({
                    plan: customer.planDetails,
                    category,
                  })}: `}
                  {`${displayPriceWithCents({
                    cents: onDemandBudgets.usedSpends[category] ?? 0,
                  })} / ${displayPriceWithCents({
                    cents: onDemandBudgets.budgets[category] ?? 0,
                  })}`}
                </small>
                <br />
              </Fragment>
            );
          })}

          <small>
            Total:{' '}
            {customer.onDemandMaxSpend > 0
              ? `${displayPriceWithCents({
                  cents: customer.onDemandSpendUsed,
                })} / ${displayPriceWithCents({cents: customer.onDemandMaxSpend})}`
              : displayPriceWithCents({cents: customer.onDemandSpendUsed})}
          </small>
        </Fragment>
      );
    }

    return (
      <Fragment>
        {onDemandPeriod}
        <br />
        <small>
          <em>Shared budget strategy</em>
        </small>
        <br />
        <small>
          Total:{' '}
          {customer.onDemandMaxSpend > 0
            ? `${displayPriceWithCents({
                cents: customer.onDemandSpendUsed,
              })} / ${displayPriceWithCents({cents: customer.onDemandMaxSpend})}`
            : displayPriceWithCents({cents: customer.onDemandSpendUsed})}
        </small>
      </Fragment>
    );
  }

  return (
    <Fragment>
      {onDemandPeriod}
      <br />
      <small>
        <em>Disabled</em>
      </small>
    </Fragment>
  );
}

type Props = {
  customer: Subscription;
  onAction: (data: any) => void;
  organization: Organization;
};

function isWithinAcceptedMargin(
  effectiveSampleRate: number,
  desiredSampleRate: number
): boolean {
  const difference = Math.abs(effectiveSampleRate - desiredSampleRate);
  return difference >= 0 && difference <= desiredSampleRate * 0.1;
}

function DynamicSampling({organization}: {organization: Organization}) {
  const dynamicSamplingEnabled = organization.features?.includes('dynamic-sampling');

  const {data, isPending, isError} = useApiQuery<{effectiveSampleRate: number | null}>(
    [`/organizations/${organization.slug}/sampling/effective-sample-rate/`],
    {
      staleTime: Infinity,
      enabled: dynamicSamplingEnabled,
    }
  );

  if (!dynamicSamplingEnabled) {
    return <ThresholdLabel positive={false}>Disabled</ThresholdLabel>;
  }
  if (isError) {
    return <ThresholdLabel positive={false}>Error loading data</ThresholdLabel>;
  }
  if (isPending) {
    return <ThresholdLabel positive={false}>Loading...</ThresholdLabel>;
  }

  if (!defined(data.effectiveSampleRate)) {
    return <ThresholdLabel positive={false}>n/a</ThresholdLabel>;
  }

  const effectiveSampleRate = data.effectiveSampleRate * 100;
  const desiredSampleRate = organization.desiredSampleRate
    ? organization.desiredSampleRate * 100
    : null;
  const diffSampleRate =
    effectiveSampleRate && desiredSampleRate
      ? Math.abs(effectiveSampleRate - desiredSampleRate)
      : null;

  return (
    <ThresholdLabel
      positive={
        effectiveSampleRate && desiredSampleRate
          ? isWithinAcceptedMargin(effectiveSampleRate, desiredSampleRate)
          : false
      }
    >
      {effectiveSampleRate && desiredSampleRate
        ? `${effectiveSampleRate.toFixed(2)}% instead of ${desiredSampleRate.toFixed(2)}% (~${diffSampleRate?.toFixed(2)}%)`
        : desiredSampleRate
          ? `${desiredSampleRate.toFixed(2)}%`
          : 'n/a'}
    </ThresholdLabel>
  );
}

function CustomerOverview({customer, onAction, organization}: Props) {
  let orgUrl = `/organizations/${organization.slug}/issues/`;
  const configFeatures = ConfigStore.get('features');
  if (configFeatures.has('system:multi-region')) {
    orgUrl = `${organization.links.organizationUrl}/issues/`;
  }

  const regionMap = ConfigStore.get('regions').reduce(
    (acc, region) => {
      acc[region.url] = region.name;
      return acc;
    },
    {} as Record<string, string>
  );
  const region = regionMap[organization.links.regionUrl] ?? '??';

  const productTrialCategories = Object.values(BILLED_DATA_CATEGORY_INFO).filter(
    categoryInfo =>
      categoryInfo.canProductTrial &&
      customer.planDetails?.categories.includes(categoryInfo.plural)
  );

  const productTrialAddOns = Object.values(customer.addOns || {}).filter(
    // TODO(billing): Right now all our add-ons can use product trials, but in future we should distinguish this
    // like we do for other product types
    addOn => addOn.isAvailable
  );

  const categoryHasUsedProductTrial = (category: DataCategory) => {
    const trial = getProductTrial(customer.productTrials ?? [], category);

    return trial?.isStarted;
  };

  const updateCustomerStatus = (action: string) => {
    const data = {
      [action]: true,
    };

    onAction(data);
  };

  const getTrialManagementActions = (
    category: DataCategory,
    apiName: string,
    trialName: string
  ) => {
    const formattedApiName = upperFirst(apiName);
    const formattedTrialName = toTitleCase(trialName, {allowInnerUpperCase: true});
    const activeProductTrial = getActiveProductTrial(
      customer.productTrials ?? [],
      category
    );
    const hasActiveProductTrial = !!activeProductTrial;
    // NOTE: we add 1 day to the end date because the trial end date is inclusive
    // and diff() can't return a value less than 0
    const lessThanOneDayLeft =
      moment(activeProductTrial?.endDate).add(1, 'day').diff(moment(), 'days') < 1;
    const hasUsedProductTrial =
      hasActiveProductTrial || categoryHasUsedProductTrial(category);
    return (
      <DetailLabel key={apiName} title={formattedTrialName}>
        <TrialState>
          <StyledTag
            variant={
              lessThanOneDayLeft
                ? 'promotion'
                : hasActiveProductTrial
                  ? 'success'
                  : hasUsedProductTrial
                    ? 'warning'
                    : 'info'
            }
          >
            {hasActiveProductTrial
              ? `Active${lessThanOneDayLeft ? ` (${moment(activeProductTrial.endDate).add(1, 'day').fromNow(true)} left)` : ''}`
              : hasUsedProductTrial
                ? 'Used'
                : 'Available'}
          </StyledTag>
          <TrialActions>
            <Button
              size="xs"
              onClick={() => updateCustomerStatus(`allowTrial${formattedApiName}`)}
              disabled={!hasUsedProductTrial || hasActiveProductTrial}
              title={
                hasActiveProductTrial
                  ? `A product trial is currently active for ${formattedTrialName}`
                  : hasUsedProductTrial
                    ? `Allow customer to start a new trial for ${formattedTrialName}`
                    : `A product trial is already available for ${formattedTrialName}`
              }
            >
              Allow Trial
            </Button>
            <Button
              size="xs"
              onClick={() => updateCustomerStatus(`startTrial${formattedApiName}`)}
              disabled={hasActiveProductTrial || hasUsedProductTrial}
              title={
                hasActiveProductTrial
                  ? `A product trial is currently active for ${formattedTrialName}`
                  : hasUsedProductTrial
                    ? `No product trial is available for ${formattedTrialName}`
                    : `Start the 14-day ${formattedTrialName} product trial`
              }
            >
              Start Trial
            </Button>
            <Button
              size="xs"
              onClick={() => updateCustomerStatus(`stopTrial${formattedApiName}`)}
              disabled={!hasActiveProductTrial || lessThanOneDayLeft}
              title={
                lessThanOneDayLeft
                  ? `Current product trial will end in less than one day`
                  : hasActiveProductTrial
                    ? `Stop the current product trial for ${formattedTrialName}`
                    : `No product trial is active for ${formattedTrialName}`
              }
            >
              Stop Trial
            </Button>
          </TrialActions>
        </TrialState>
      </DetailLabel>
    );
  };

  return (
    <DetailsContainer>
      <div>
        <DetailList>
          <DetailLabel title="Status">
            <CustomerStatus customer={customer} />
            {customer.isTrial && (
              <div>
                <small>
                  <strong>{moment(customer.trialEnd).fromNow(true)} remaining</strong>{' '}
                  (ends on {moment(customer.trialEnd).format('MMMM Do YYYY')})
                </small>
              </div>
            )}
          </DetailLabel>
          <DetailLabel title="Members">
            {customer.totalMembers?.toLocaleString()}
          </DetailLabel>
          <DetailLabel title="Projects">
            {customer.totalProjects?.toLocaleString()} / {UNLIMITED}{' '}
          </DetailLabel>
          <DetailLabel title="ARR">
            {formatCurrency(customer.acv ?? 0)}
            {customer.type === 'invoiced' && customer.billingInterval === 'annual' && (
              <span>
                {' | '}
                <ChangeARRAction customer={customer} onAction={onAction} />
              </span>
            )}
          </DetailLabel>
        </DetailList>

        <h6>Subscription</h6>
        <SubscriptionSummary customer={customer} onAction={onAction} />
        <ReservedData customer={customer} />
        <ReservedBudgetsData customer={customer} />
        <h6>PCSS</h6>
        <DetailList>
          <DetailLabel title="Custom Price PCSS">
            {typeof customer.customPricePcss === 'number'
              ? displayPriceWithCents({cents: customer.customPricePcss})
              : 'None'}
          </DetailLabel>
        </DetailList>
        <h6>Total</h6>
        <DetailList>
          <DetailLabel title="Custom Price (Total)">
            {typeof customer.customPrice === 'number'
              ? displayPriceWithCents({cents: customer.customPrice})
              : 'None'}
          </DetailLabel>
        </DetailList>
      </div>
      <div>
        <DetailList>
          <DetailLabel title="Short name">
            <ExternalLink href={orgUrl}>{customer.slug}</ExternalLink>
          </DetailLabel>
          <DetailLabel title="Internal ID">{customer.id}</DetailLabel>
          <DetailLabel title="Data Storage Location">{region}</DetailLabel>
          <DetailLabel title="Data Retention">
            {customer.orgRetention?.standard ??
              customer.categories?.errors?.retention?.standard ??
              90}
            {' days'}
          </DetailLabel>
          <DetailLabel title="Joined">
            {moment(customer.dateJoined).fromNow()}
          </DetailLabel>
          <DetailLabel title="Contact">
            {customer.owner ? <CustomerContact owner={customer.owner} /> : 'n/a'}{' '}
          </DetailLabel>
          <DetailLabel title="Type">{customer.type || 'n/a'}</DetailLabel>
          <DetailLabel title="Channel">{customer.channel || 'n/a'}</DetailLabel>
          <DetailLabel title="Sponsored Type">
            {customer.sponsoredType || 'n/a'}
          </DetailLabel>
          <DetailLabel title="Billing Country">
            {customer.countryCode
              ? (getCountryByCode(customer.countryCode)?.name ?? customer.countryCode)
              : 'n/a'}
          </DetailLabel>
          <DetailLabel title="Payment Source">
            {customer.paymentSource ? `··· ${customer.paymentSource.last4}` : 'n/a'}{' '}
          </DetailLabel>
          <DetailLabel title="Dynamic Sampling Mode">
            {organization.samplingMode ?? 'n/a'}
          </DetailLabel>
          <DynamicSampling organization={organization} />
        </DetailList>

        <h6>Linked Accounts</h6>
        <DetailList>
          <DetailLabel title="Stripe ID">
            {customer.stripeCustomerID ? (
              <ExternalLink
                href={`https://dashboard.stripe.com/customers/${customer.stripeCustomerID}`}
              >
                {customer.stripeCustomerID}
              </ExternalLink>
            ) : (
              'n/a'
            )}
          </DetailLabel>
          <DetailLabel
            title={
              <Tooltip title="A partner account is managed by a third-party (such as Heroku).">
                <abbr>Partner</abbr>
              </Tooltip>
            }
          >
            {customer.partner ? (
              <Fragment>
                {customer.partner.partnership.displayName}{' '}
                {customer.partner.isActive ? (
                  <Fragment>
                    (active)
                    <br />
                    <Button
                      priority="link"
                      onClick={() => updateCustomerStatus('deactivatePartnerAccount')}
                    >
                      Deactivate Partner
                    </Button>
                  </Fragment>
                ) : (
                  <Fragment>(migrated)</Fragment>
                )}
                <br />
                <small>ID: {customer.partner.externalId}</small>
                {customer.partner.partnership.id === 'HK' && (
                  <span>
                    <br />
                    <small>Heroku ID: {customer.partner.name}</small>
                  </span>
                )}
              </Fragment>
            ) : (
              'n/a'
            )}
          </DetailLabel>
          <DetailLabel title="SFDC Account">
            <ExternalLink
              href={`https://getsentry.lightning.force.com/apex/redirectToAccountPage?organizationId=${customer.id}`}
            >
              {customer.id}
            </ExternalLink>
          </DetailLabel>
        </DetailList>

        <h6>Queries</h6>
        <DetailList>
          <DetailLabel title="Looker">
            <ExternalLink
              href={`https://sentryio.cloud.looker.com/dashboards/724?Organization%20ID=${customer.id}`}
            >
              Single Org Details Dashboard
            </ExternalLink>
          </DetailLabel>
          <DetailLabel title="Google Cloud Logging">
            <ExternalLink href={getLogQuery('api', {organizationId: customer.id})}>
              API Logs
            </ExternalLink>
            {' | '}
            <ExternalLink href={getLogQuery('audit', {organizationId: customer.id})}>
              Audit
            </ExternalLink>
            {' | '}
            <ExternalLink href={getLogQuery('email', {organizationId: customer.id})}>
              Emails
            </ExternalLink>
            {' | '}
            <ExternalLink href={getLogQuery('billing', {organizationId: customer.id})}>
              Billing
            </ExternalLink>
            {' | '}
            <ExternalLink href={getLogQuery('auth', {organizationId: customer.id})}>
              Auth
            </ExternalLink>
          </DetailLabel>
        </DetailList>
        {productTrialCategories.length + productTrialAddOns.length > 0 && (
          <Fragment>
            <h6>Product Trials</h6>
            <ProductTrialsDetailListContainer>
              {productTrialCategories.map(categoryInfo => {
                const categoryName = getPlanCategoryName({
                  plan: customer.planDetails,
                  category: categoryInfo.plural,
                  title: true,
                });
                return getTrialManagementActions(
                  categoryInfo.plural,
                  categoryInfo.plural,
                  categoryName
                );
              })}
              {productTrialAddOns.map(addOn => {
                const category = getBilledCategory(customer, addOn.apiName);
                if (category) {
                  return getTrialManagementActions(
                    category,
                    addOn.apiName,
                    addOn.apiName === AddOnCategory.LEGACY_SEER
                      ? addOn.productName + ' (Legacy)'
                      : addOn.productName
                  );
                }
                return null;
              })}
            </ProductTrialsDetailListContainer>
          </Fragment>
        )}
        <Fragment>
          <h6>Retention Settings</h6>
          <table style={{borderSpacing: '15px', borderCollapse: 'separate'}}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Standard</th>
                <th>
                  <Tooltip title="Null means use the Downsample default">
                    Downsampled
                  </Tooltip>
                </th>
                <th>
                  <Tooltip title="Zero means use the standard retention.">
                    Downsample Default
                  </Tooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortCategories(customer.categories || {})
                .filter(bmh => RETENTION_SETTINGS_CATEGORIES.has(bmh.category))
                .map(bmh => (
                  <tr key={bmh.category}>
                    <td>
                      {getPlanCategoryName({
                        plan: customer.planDetails,
                        category: bmh.category,
                      })}
                    </td>
                    <td>{bmh.retention?.standard}</td>
                    <td>
                      {bmh.retention?.downsampled === null
                        ? 'null'
                        : bmh.retention?.downsampled}
                    </td>
                    <td>
                      {customer.planDetails.retentions?.[bmh.category]?.downsampled}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Fragment>
      </div>
    </DetailsContainer>
  );
}

const TrialState = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const TrialActions = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-wrap: wrap;
  align-items: center;
`;

const ProductTrialsDetailListContainer = styled(DetailList)`
  align-items: baseline;
  dt {
    justify-self: start;
    display: flex;
    align-items: center;
    min-height: 38px;
  }
  dd {
    display: flex;
    align-items: center;
    min-height: 38px;
  }
`;

const StyledTag = styled(Tag)`
  width: fit-content;
`;

type ThresholdLabelProps = {
  children: React.ReactNode;
  positive: boolean;
};

function ThresholdLabel({positive, children}: ThresholdLabelProps) {
  return (
    <Fragment>
      <dt>Sample Rate (24h):</dt>
      <ThresholdValue positive={positive}>{children}</ThresholdValue>
    </Fragment>
  );
}

const ThresholdValue = styled('dd')<{positive: boolean}>`
  color: ${p => (p.positive ? p.theme.colors.green500 : p.theme.red400)};
`;

export default CustomerOverview;
