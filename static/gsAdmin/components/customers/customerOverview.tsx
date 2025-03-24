import {Fragment} from 'react';
import styled from '@emotion/styled';
import upperFirst from 'lodash/upperFirst';
import moment from 'moment-timezone';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ResponseMeta} from 'sentry/api';
import {Button} from 'sentry/components/core/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';

import ChangeARRAction from 'admin/components/changeARRAction';
import ChangeContractEndDateAction from 'admin/components/changeContractEndDateAction';
import CustomerContact from 'admin/components/customerContact';
import CustomerStatus from 'admin/components/customerStatus';
import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';
import {getLogQuery} from 'admin/utils';
import {PRODUCT_TRIAL_CATEGORIES, UNLIMITED} from 'getsentry/constants';
import type {
  Plan,
  ReservedBudget,
  ReservedBudgetMetricHistory,
  Subscription,
} from 'getsentry/types';
import {BillingType, OnDemandBudgetMode} from 'getsentry/types';
import {formatBalance, formatReservedWithUnits} from 'getsentry/utils/billing';
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
        <DetailLabel title="On-Demand">
          <OnDemandSummary customer={customer} />
        </DetailLabel>
        <DetailLabel title="Can Trial" yesNo={customer.canTrial} />
        <DetailLabel title="Can Grace Period" yesNo={customer.canGracePeriod} />
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

type ReservedBudgetProps = {
  customer: Subscription;
  reservedBudget: ReservedBudget;
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
                <DetailLabel title={`Pay-as-you-go Cost-Per-Event ${categoryName}`}>
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
  if (!customer.hasReservedBudgets || !customer.reservedBudgets) {
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

function ReservedBudgetData({customer, reservedBudget}: ReservedBudgetProps) {
  const categories = Object.keys(reservedBudget.categories);
  if (categories.length === 0) {
    return null;
  }

  const shouldUseDsNames = customer.planDetails.categories.includes(
    DataCategory.SPANS_INDEXED
  );

  const budgetName = getReservedBudgetDisplayName({
    plan: customer.planDetails,
    categories,
    hadCustomDynamicSampling: shouldUseDsNames,
    shouldTitleCase: true,
  });

  return (
    <Fragment>
      <h6>{budgetName} Reserved Budget</h6>
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
                  {`${getPlanCategoryName({plan: customer.planDetails, category})}: `}
                  {`${displayPriceWithCents({
                    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    cents: onDemandBudgets.usedSpends[category] ?? 0,
                  })} / ${displayPriceWithCents({
                    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
  if (organization.features?.includes('dynamic-sampling')) {
    const effectiveSampleRate = organization.effectiveSampleRate
      ? organization.effectiveSampleRate * 100
      : null;
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
  return <ThresholdLabel positive={false}>Disabled</ThresholdLabel>;
}

function CustomerOverview({customer, onAction, organization}: Props) {
  let orgUrl = `/organizations/${organization.slug}/issues/`;
  const configFeatures = ConfigStore.get('features');
  const api = useApi();
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

  const productTrialCategories = customer.canSelfServe
    ? PRODUCT_TRIAL_CATEGORIES.filter(category =>
        customer.planDetails.categories.includes(category)
      )
    : [];

  function updateProductTrialStatus(action: string, category: DataCategory) {
    const key = action + upperFirst(category);
    const data = {
      [key]: true,
    };
    api.request(`/customers/${organization.id}/`, {
      method: 'PUT',
      data,
      success: resp => {
        addSuccessMessage(`${resp.message}`);
      },
      error: (resp: ResponseMeta) => {
        addErrorMessage(
          `Error updating product trial status: ${resp.responseJSON?.message}`
        );
      },
    });
  }

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
            {customer.dataRetention || '90d'}
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
                {`(${customer.partner.isActive ? 'active' : 'migrated'})`}
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
        {productTrialCategories.length > 0 && (
          <Fragment>
            <h6>Product Trials</h6>
            <DetailList>
              {productTrialCategories.map(category => {
                const categoryName = titleCase(
                  getPlanCategoryName({plan: customer.planDetails, category})
                );
                return (
                  <DetailLabel key={category} title={categoryName}>
                    <Button
                      priority="link"
                      onClick={() => updateProductTrialStatus('allowTrial', category)}
                    >
                      {tct('Allow [categoryName] Trial', {categoryName})}
                    </Button>
                    {' |'}
                    <Button
                      priority="link"
                      onClick={() => updateProductTrialStatus('startTrial', category)}
                    >
                      {tct('Start [categoryName] Trial', {categoryName})}
                    </Button>
                    {' | '}
                    <Button
                      priority="link"
                      onClick={() => updateProductTrialStatus('stopTrial', category)}
                    >
                      {tct('Stop [categoryName] Trial', {categoryName})}
                    </Button>
                  </DetailLabel>
                );
              })}
            </DetailList>
          </Fragment>
        )}
      </div>
    </DetailsContainer>
  );
}

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
  color: ${p => (p.positive ? p.theme.green400 : p.theme.red400)};
`;

export default CustomerOverview;
