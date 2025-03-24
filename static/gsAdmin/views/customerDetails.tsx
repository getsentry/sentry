import {useEffect} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import scrollToElement from 'scroll-to-element';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {OrganizationContext} from 'sentry/views/organizationContext';

import addBillingMetricUsage from 'admin/components/addBillingMetricUsage';
import addGiftBudgetAction from 'admin/components/addGiftBudgetAction';
import AddGiftEventsAction from 'admin/components/addGiftEventsAction';
import {triggerAM2CompatibilityCheck} from 'admin/components/am2CompatibilityCheckModal';
import CancelSubscriptionAction from 'admin/components/cancelSubscriptionAction';
import triggerChangeBalanceModal from 'admin/components/changeBalanceAction';
import triggerChangeDatesModal from 'admin/components/changeDatesAction';
import triggerGoogleDomainModal from 'admin/components/changeGoogleDomainAction';
import ChangePlanAction from 'admin/components/changePlanAction';
import CloseAccountInfo from 'admin/components/closeAccountInfo';
import CustomerCharges from 'admin/components/customers/customerCharges';
import CustomerHistory from 'admin/components/customers/customerHistory';
import CustomerIntegrations from 'admin/components/customers/customerIntegrations';
import CustomerInvoices from 'admin/components/customers/customerInvoices';
import CustomerMembers from 'admin/components/customers/customerMembers';
import CustomerOnboardingTasks from 'admin/components/customers/customerOnboardingTasks';
import CustomerOverview from 'admin/components/customers/customerOverview';
import CustomerPlatforms from 'admin/components/customers/customerPlatforms';
import CustomerPolicies from 'admin/components/customers/customerPolicies';
import CustomerProjects from 'admin/components/customers/customerProjects';
import {CustomerStats} from 'admin/components/customers/customerStats';
import {
  CustomerStatsFilters,
  DataType,
} from 'admin/components/customers/customerStatsFilters';
import OrganizationStatus from 'admin/components/customers/organizationStatus';
import PendingChanges from 'admin/components/customers/pendingChanges';
import type {ActionItem, BadgeItem} from 'admin/components/detailsPage';
import DetailsPage from 'admin/components/detailsPage';
import ForkCustomerAction from 'admin/components/forkCustomer';
import triggerEndPeriodEarlyModal from 'admin/components/nextBillingPeriodAction';
import triggerProvisionSubscription from 'admin/components/provisionSubscriptionAction';
import SelectableContainer from 'admin/components/selectableContainer';
import SendWeeklyEmailAction from 'admin/components/sendWeeklyEmailAction';
import SponsorshipAction from 'admin/components/sponsorshipAction';
import SuspendAccountAction from 'admin/components/suspendAccountAction';
import testVercelApiEndpoint from 'admin/components/testVCApiEndpoints';
import toggleSpendAllocationModal from 'admin/components/toggleSpendAllocationModal';
import TrialSubscriptionAction from 'admin/components/trialSubscriptionAction';
import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {Subscription} from 'getsentry/types';
import {
  hasActiveVCFeature,
  isBizPlanFamily,
  isUnlimitedReserved,
} from 'getsentry/utils/billing';
import {getPlanCategoryName, GIFT_CATEGORIES} from 'getsentry/utils/dataCategory';

const DEFAULT_ERROR_MESSAGE = 'Unable to update the customer account';

function makeSubscriptionQueryKey(orgId: string): ApiQueryKey {
  return [`/customers/${orgId}/`];
}

function makeOrganizationQueryKey(orgId: string): ApiQueryKey {
  return [`/organizations/${orgId}/`, {query: {detailed: 0, include_feature_flags: 1}}];
}

export default function CustomerDetails() {
  const {orgId} = useParams<{orgId: string}>();
  const location = useLocation();
  const navigate = useNavigate();

  const api = useApi();
  const queryClient = useQueryClient();
  const SUBSCRIPTION_QUERY_KEY = makeSubscriptionQueryKey(orgId);
  const ORGANIZATION_QUERY_KEY = makeOrganizationQueryKey(orgId);
  const {
    data: subscription,
    refetch: refetchSubscription,
    isError: isErrorSubscription,
    isPending: isPendingSubscription,
  } = useApiQuery<Subscription>(SUBSCRIPTION_QUERY_KEY, {staleTime: 0});
  const {
    data: organization,
    refetch: refetchOrganization,
    isError: isErrorOrganization,
    isPending: isPendingOrganization,
  } = useApiQuery<Organization>(ORGANIZATION_QUERY_KEY, {staleTime: 0});

  useEffect(() => {
    if (location.query.dataType) {
      scrollToElement('#stats-filter');
    }
  });

  const reloadData = () => {
    refetchSubscription();
    refetchOrganization();
  };

  if (isPendingSubscription || isPendingOrganization) {
    return <LoadingIndicator />;
  }

  if (isErrorSubscription || isErrorOrganization) {
    return <LoadingError onRetry={reloadData} />;
  }

  if (subscription === null || organization === null) {
    return null;
  }

  const activeDataType = Object.values(DataType).includes(
    location.query.dataType as DataType
  )
    ? (location.query.dataType as DataType)
    : DataType.ERRORS;

  const userPermissions = ConfigStore.get('user')?.permissions;

  const isBillingAdmin = !!userPermissions?.has?.('billing.admin');

  const hasProvisionPermission = !!userPermissions?.has?.('billing.provision');

  const isPolicyAdmin = !!userPermissions?.has?.('policies.admin');

  const giftCategories = () => {
    if (subscription === null) {
      return {};
    }
    // Can only gift for checkout categories
    return Object.fromEntries(
      GIFT_CATEGORIES.map(category => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        const reserved = subscription.categories?.[category]?.reserved;
        const isUnlimited = isUnlimitedReserved(reserved);
        const isReservedBudgetQuota = reserved === RESERVED_BUDGET_QUOTA;
        return [
          category,
          {
            disabled:
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              !subscription.categories?.[category] ||
              !subscription.planDetails.checkoutCategories.includes(category) ||
              isUnlimited ||
              isReservedBudgetQuota,
            displayName: getPlanCategoryName({
              plan: subscription.planDetails,
              category,
              capitalize: false,
              hadCustomDynamicSampling: isReservedBudgetQuota,
            }),
            isUnlimited,
            isReservedBudgetQuota,
          },
        ];
      })
    );
  };

  const handleStatsTypeChange = (dataType: DataType) => {
    navigate({
      pathname: location.pathname,
      query: {...location.query, dataType},
    });
  };

  const onUpdate = (params: Record<string, any>) => {
    addLoadingMessage('Saving changes\u2026');
    api.request(`/customers/${orgId}/`, {
      method: 'PUT',
      data: params,
      success: data => {
        addSuccessMessage(
          `Customer account has been updated with ${JSON.stringify(params)}.`
        );

        onSuccess(data);
      },
      error: resp => {
        if (resp.status === 400 || resp.status === 402) {
          const errors = Object.values(resp.responseJSON || {});
          const error = errors.length && errors[0];

          const message =
            typeof error === 'string'
              ? error
              : Array.isArray(error) && error.length && error[0]
                ? error[0]
                : DEFAULT_ERROR_MESSAGE;

          addErrorMessage(message);
        } else {
          addErrorMessage(DEFAULT_ERROR_MESSAGE);
        }
      },
    });
  };

  const onSuccess = (data: Subscription) => {
    setApiQueryData(queryClient, SUBSCRIPTION_QUERY_KEY, data);
  };

  const onChangePlan = (params: Record<string, any>) => {
    // XXX The actual plan update queries are part of the modal action body

    if (!params.plan) {
      addErrorMessage(params.error.responseText);
      return;
    }

    // Reload data as changing a plan can cancel a previous pending plan.
    reloadData();
  };

  const onForkCustomer = (params: Record<string, any>) => {
    if (params.error) {
      addErrorMessage(params.error.responseJSON.detail);
    } else {
      addSuccessMessage('The relocation job has started!');
    }
  };

  const onChangeGoogleDomain = (params: Record<string, any>) => {
    if (params.newDomain) {
      const msg = JSON.stringify(params.newDomain);
      addSuccessMessage(`Customer account has been updated with new domain: ${msg}.`);
    } else {
      const msg = JSON.stringify(params.error.responseText);
      addErrorMessage(`Failed to update new domain due to ${msg}.`);
    }
  };

  const onToggleSpendAllocation = ({
    error,
    spendAllocationEnabled,
  }: {
    error: RequestError;
    spendAllocationEnabled: boolean;
  }) => {
    if (error) {
      const msg = JSON.stringify(error.responseText);
      addErrorMessage(t('Failed to toggle spend allocations due to [msg]', {msg}));
    } else {
      const clone = cloneDeep(subscription);
      if (clone) {
        clone.spendAllocationEnabled = spendAllocationEnabled;
        setApiQueryData(queryClient, SUBSCRIPTION_QUERY_KEY, clone);
      }
      addSuccessMessage(
        tct('Spend Allocations has been [action] for organization.', {
          action: spendAllocationEnabled ? t('enabled') : t('disabled'),
        })
      );
    }
  };

  const regionMap = ConfigStore.get('regions').reduce(
    (acc: any, region: any) => {
      acc[region.url] = region.name;
      return acc;
    },
    {} as Record<string, string>
  );
  const region = regionMap[organization?.links.regionUrl || 'unknown'] ?? 'unknown';

  const badges: BadgeItem[] = [
    {name: 'Grace Period', level: 'warning', visible: subscription.isGracePeriod},
    {name: 'Capacity Limit', level: 'warning', visible: subscription.usageExceeded},
    {
      name: 'Suspended',
      level: 'error',
      help: subscription.suspensionReason,
      visible: subscription.isSuspended,
    },
    {
      name: 'OnDemand Disabled',
      help: 'OnDemand has been disabled for this account due to payment failures',
      level: 'warning',
      visible: subscription.onDemandDisabled,
    },
  ];

  const billingSections = [
    {
      key: 'usage',
      name: 'Usage',
      content: ({Panel}: any) => <CustomerHistory inPanel={Panel} orgId={orgId} />,
    },
    {
      key: 'invoices',
      name: 'Invoices',
      content: ({Panel}: any) => (
        <CustomerInvoices inPanel={Panel} orgId={orgId} region={region} />
      ),
    },
    {
      key: 'charges',
      name: 'Charges',
      content: ({Panel}: any) => (
        <CustomerCharges inPanel={Panel} orgId={orgId} region={region} />
      ),
    },
  ];

  const billingDetails = (
    <SelectableContainer
      panelTitle="Billing Details"
      dropdownPrefix="Billing"
      sections={billingSections}
    />
  );

  const productUsageSections = [
    {
      key: 'onboardingTasks',
      name: 'Onboarding Tasks',
      content: ({Panel}: any) => (
        <CustomerOnboardingTasks inPanel={Panel} orgId={orgId} />
      ),
    },
    {
      key: 'integrations',
      name: 'Plugins',
      content: ({Panel}: any) => <CustomerIntegrations inPanel={Panel} orgId={orgId} />,
    },
    {
      key: 'platforms',
      name: 'Platforms',
      content: ({Panel}: any) => <CustomerPlatforms inPanel={Panel} orgId={orgId} />,
    },
  ];

  const productUsage = (
    <SelectableContainer
      panelTitle="Product Usage"
      dropdownPrefix="Product"
      sections={productUsageSections}
    />
  );

  const actionRequiresBillingAdmin = {
    disabled: !isBillingAdmin,
    disabledReason: 'Requires billing admin permissions.',
  };

  const orgFeatures = organization?.features ?? [];
  const hasAdminTestFeatures = orgFeatures.includes('add-billing-metric-usage-admin');

  return (
    <ErrorBoundary>
      <DetailsPage
        rootName="Customers"
        name={subscription.name}
        badges={badges}
        actions={[
          {
            key: 'allowTrial',
            name: 'Allow Trial',
            help: 'Allow this account to opt-in to a trial period.',
            visible: !subscription.canTrial && !subscription.isTrial,
            onAction: params => onUpdate({...params, canTrial: true}),
          },
          {
            key: 'endTrialEarly',
            name: 'End Trial Early',
            help: 'End the current trial immediately.',
            disabled: !subscription.isTrial,
            disabledReason: 'This account is not on on trial.',
            onAction: params => onUpdate({...params, endTrialEarly: true}),
          },
          {
            key: 'convertToSponsored',
            name: 'Convert to Sponsored',
            help: 'Convert this account to a sponsored plan (e.g. education, open source).',
            disabled: subscription.isPartner,
            disabledReason: 'Partner accounts cannot be put on sponsored plans',
            confirmModalOpts: {
              renderModalSpecificContent: deps => (
                <SponsorshipAction subscription={subscription} {...deps} />
              ),
            },
            onAction: params => onUpdate({...params}),
          },
          {
            key: 'allowGrace',
            name: 'Allow Grace Period',
            help: 'Allow this account to enter a grace period upon next overage.',
            disabled: subscription.canGracePeriod,
            disabledReason: 'Account may already be in a grace period',
            onAction: params => onUpdate({...params, canGracePeriod: true}),
          },
          {
            key: 'clearPendingChanges',
            name: 'Clear Pending Changes',
            help: 'Remove pending subscription changes.',
            visible: !!subscription.pendingChanges,
            onAction: params => onUpdate({...params, clearPendingChanges: true}),
          },
          {
            key: 'changeSoftCap',
            name: subscription.hasSoftCap
              ? 'Remove Legacy Soft Cap'
              : 'Add Legacy Soft Cap',
            help: subscription.hasSoftCap
              ? 'Remove the legacy soft cap from this account.'
              : 'Add legacy soft cap to this account.',
            onAction: params => onUpdate({...params, softCap: !subscription.hasSoftCap}),
            ...actionRequiresBillingAdmin,
          },
          {
            key: 'changeBalance',
            name: 'Add or Remove Credit',
            help: 'Add or remove credit from this account.',
            skipConfirmModal: true, // ZD ticket fields added in component rendered by triggerChangeBalanceModal
            onAction: () =>
              triggerChangeBalanceModal({
                orgId,
                subscription,
                onSuccess: reloadData,
              }),
            ...actionRequiresBillingAdmin,
          },
          {
            key: 'changeOverageNotification',
            name: subscription.hasOverageNotificationsDisabled
              ? 'Enable Overage Notification'
              : 'Disable Overage Notification',
            help: subscription.hasOverageNotificationsDisabled
              ? 'Enable overage notifications on this account.'
              : 'Disable overage notifications on this account.',
            visible: subscription.hasSoftCap,
            onAction: params =>
              onUpdate({
                ...params,
                overageNotificationsDisabled:
                  !subscription.hasOverageNotificationsDisabled,
              }),
            ...actionRequiresBillingAdmin,
          },
          {
            key: 'convertToSelfServe',
            name: 'Convert to self-serve',
            help: 'Cancel subscription and convert to self-serve.',
            visible:
              !subscription.isPartner &&
              subscription.isFree &&
              !subscription.canSelfServe,
            onAction: params => onUpdate({...params, cancel: true}),
            ...actionRequiresBillingAdmin,
          },
          {
            key: 'terminateContract',
            name: 'Terminate Contract',
            help: 'Terminate the contract (charges an early termination fee for contracts with 3 or more months remaining).',
            visible:
              subscription.contractInterval === 'annual' &&
              subscription.canCancel &&
              !subscription.cancelAtPeriodEnd,
            onAction: params => onUpdate({...params, terminateContract: true}),
            ...actionRequiresBillingAdmin,
          },
          {
            key: 'changeOnDemandBilling',
            name: subscription.onDemandInvoiced
              ? 'Disable On Demand Billing'
              : 'Enable On Demand Billing',
            help: subscription.onDemandInvoiced
              ? "Current on demand usage will be invoiced and the next billing period's on demand maximum will be $0."
              : "Enables separate invoices for on demand events (charged to the customer's default card).",
            visible:
              subscription.type === 'invoiced' &&
              !!subscription.paymentSource &&
              !subscription.onDemandInvoicedManual,
            onAction: params =>
              onUpdate({...params, onDemandInvoiced: !subscription.onDemandInvoiced}),
            ...actionRequiresBillingAdmin,
          },
          {
            key: 'suspendAccount',
            name: 'Suspend Account',
            help: 'Suspend this account for abuse.',
            visible: !subscription.isSuspended,
            confirmModalOpts: {
              disableConfirmButton: true,
              priority: 'danger',
              confirmText: 'Suspend Account',
              renderModalSpecificContent: deps => <SuspendAccountAction {...deps} />,
            },
            onAction: ({suspensionReason}) =>
              onUpdate({suspended: true, suspensionReason}),
          },
          {
            key: 'unsuspendAccount',
            name: 'Unsuspend Account',
            help: 'Remove the suspension on this account.',
            visible: subscription.isSuspended,
            onAction: params => onUpdate({...params, suspended: false}),
          },
          {
            key: 'startEnterpriseTrial',
            name: 'Start Enterprise Trial',
            help: 'Start enterprise trial (e.g. SSO, unlimited events).',
            disabled: subscription.isPartner || subscription.isEnterpriseTrial,
            disabledReason: subscription.isPartner
              ? 'This account is managed by a third-party.'
              : 'Already on an enterprise trial.',
            confirmModalOpts: {
              renderModalSpecificContent: deps => (
                <TrialSubscriptionAction
                  subscription={subscription}
                  startEnterpriseTrial
                  canUseTrialOverride={hasAdminTestFeatures}
                  {...deps}
                />
              ),
            },
            onAction: params => onUpdate({...params}),
          },
          {
            key: 'startTrial',
            name: subscription.isTrial ? 'Extend Trial' : 'Start Trial',
            help: 'Start or extend a trial for this account.',
            confirmModalOpts: {
              renderModalSpecificContent: deps => (
                <TrialSubscriptionAction subscription={subscription} {...deps} />
              ),
            },
            onAction: params => onUpdate({...params}),
          },
          {
            key: 'changeDates',
            name: 'Change Dates',
            help: 'Change the contract and on-demand period dates.',
            skipConfirmModal: true,
            visible: hasAdminTestFeatures,
            onAction: () =>
              triggerChangeDatesModal({
                orgId,
                subscription,
                onSuccess: reloadData,
              }),
          },
          {
            key: 'endPeriodEarly',
            name: 'End Billing Period Immediately',
            help: 'End the current period immediately and start a new one.',
            skipConfirmModal: true,
            visible: hasAdminTestFeatures,
            onAction: () =>
              triggerEndPeriodEarlyModal({
                orgId,
                subscription,
                onSuccess: reloadData,
              }),
          },
          {
            key: 'changePlan',
            name: 'Change Plan',
            help: 'Upgrade (or downgrade) this subscription.',
            disabled:
              // Enabling admin to modify NT for partnership support
              subscription.partner?.partnership.id !== 'NT' &&
              (subscription.partner?.isActive ||
                !subscription.paymentSource ||
                !subscription.paymentSource.last4),
            disabledReason: subscription.partner?.isActive
              ? 'This account is managed by a third-party.'
              : 'No payment method on file.',
            confirmModalOpts: {
              disableConfirmButton: true,
              priority: 'danger',
              confirmText: 'Change Plan',
              renderModalSpecificContent: deps => (
                <ChangePlanAction
                  orgId={orgId}
                  {...deps}
                  partnerPlanId={
                    subscription.partner?.isActive ? subscription.planDetails.id : null
                  }
                />
              ),
            },
            onAction: params => onChangePlan({...params}),
          },
          {
            key: 'checkAM2',
            name: 'Check AM2 Compatibility',
            help: 'Check if this account can be switched to AM2',
            skipConfirmModal: true,
            onAction: () => triggerAM2CompatibilityCheck({organization}),
          },
          {
            key: 'closeAccount',
            name: 'Close Account',
            help: 'Close the account, and remove all data.',
            confirmModalOpts: {
              priority: 'danger',
              confirmText: 'Close Account',
              modalSpecificContent: <CloseAccountInfo />,
            },
            onAction: params => onUpdate({...params, orgClose: true}),
          },
          {
            key: 'forkCustomer',
            name: 'Fork Customer',
            help: "Duplicate of this customer's metadata in a different region.",
            confirmModalOpts: {
              priority: 'danger',
              confirmText: 'Fork Customer into Another Region',
              renderModalSpecificContent: deps => (
                <ForkCustomerAction organization={organization} {...deps} />
              ),
            },
            onAction: params => onForkCustomer({...params, cancel: true}),
          },
          {
            key: 'cancelSubscription',
            name: 'Cancel Subscription',
            help: 'Downgrade the subscription to free.',
            confirmModalOpts: {
              priority: 'danger',
              confirmText: 'Cancel Subscription',
              renderModalSpecificContent: deps => (
                <CancelSubscriptionAction subscription={subscription} {...deps} />
              ),
            },
            onAction: params => onUpdate({...params, cancel: true}),
          },
          {
            key: 'provisionSubscription',
            name: 'Provision Subscription',
            help: 'Schedule changes to this subscription now or at a future date.',
            disabled: !isBillingAdmin || !hasProvisionPermission,
            disabledReason: isBillingAdmin
              ? 'Requires provisioning permissions.'
              : 'Requires billing admin permissions.',
            skipConfirmModal: true,
            onAction: () =>
              triggerProvisionSubscription({
                orgId,
                subscription,
                canProvisionDsPlan: hasAdminTestFeatures,
                onSuccess: reloadData,
              }),
          },
          {
            key: 'toggleSpendAllocations',
            name: 'Toggle Spend Allocations',
            help: 'Enable or disable the spend allocation organization option.',
            disabled:
              !orgFeatures.includes('spend-allocations') &&
              !isBizPlanFamily(subscription.planDetails),
            disabledReason:
              'Spend Allocations can only be enabled for Business and Enterprise plans.',
            skipConfirmModal: true,
            onAction: () =>
              toggleSpendAllocationModal({
                orgId,
                spendAllocationEnabled: subscription.spendAllocationEnabled,
                onUpdated: onToggleSpendAllocation,
              }),
          },
          {
            key: 'changeGoogleDomain',
            name: 'Change Google Domain',
            help: 'Swap or add a Google Domain.',
            skipConfirmModal: true,
            onAction: () =>
              triggerGoogleDomainModal({orgId, onUpdated: onChangeGoogleDomain}),
          },
          {
            key: 'sendWeeklyReport',
            name: 'Send Weekly Report',
            help: 'Send a weekly report to one or all members of this organization',
            confirmModalOpts: {
              showAuditFields: false,
              priority: 'danger',
              confirmText: 'Send',
              renderModalSpecificContent: deps => (
                <SendWeeklyEmailAction orgId={orgId} {...deps} />
              ),
            },
            onAction: params => onUpdate({...params}),
          },
          {
            key: 'confirmMSAUpdatedForDataConsent',
            name: 'Confirm MSA Updated for Data Consent',
            help: "Confirm that customer's MSA has been updated.",
            visible: defined(subscription.msaUpdatedForDataConsent),
            disabled: !isPolicyAdmin,
            disabledReason: 'Requires policies:admin permissions.',
            skipConfirmModal: true,
            onAction: params => onUpdate({...params, msaUpdatedForDataConsent: true}),
          },
          ...Object.entries(giftCategories()).map<ActionItem>(
            ([
              dataCategory,
              {displayName, disabled, isUnlimited, isReservedBudgetQuota},
            ]) => ({
              key: `gift-${dataCategory}`,
              name: `Gift ${displayName}`,
              help: `Give free ${displayName} for the current billing period.`,
              disabled,
              disabledReason: isUnlimited
                ? 'Cannot gift to unlimited quota.'
                : isReservedBudgetQuota
                  ? 'Gift to the reserved budget'
                  : `Plan does not support gifted ${displayName}.`,
              confirmModalOpts: {
                renderModalSpecificContent: deps => (
                  <AddGiftEventsAction
                    dataCategory={dataCategory as DataCategory}
                    subscription={subscription}
                    {...deps}
                  />
                ),
              },
              onAction: params => onUpdate({...params}),
            })
          ),
          {
            key: 'addGiftBudgetAction',
            name: 'Gift to reserved budget',
            help: 'Select a reserved budget and gift it free dollars for the current billing period.',
            visible: subscription.hasReservedBudgets,
            skipConfirmModal: true,
            onAction: () => {
              addGiftBudgetAction({
                onSuccess: reloadData,
                organization,
                subscription,
              });
            },
          },
          {
            key: 'addBillingMetricUsage',
            name: 'Add Billing Metric Usage',
            help: 'Create and add Billing Metric Usage.',
            skipConfirmModal: true,
            visible: hasAdminTestFeatures,
            onAction: () =>
              addBillingMetricUsage({
                onSuccess: reloadData,
                organization,
              }),
          },
          {
            key: 'testVercelApi',
            name: 'Test Vercel API',
            help: 'Send API requests to Vercel',
            skipConfirmModal: true,
            visible: subscription.isSelfServePartner && hasActiveVCFeature(organization),
            onAction: () =>
              testVercelApiEndpoint({
                onSuccess: () => reloadData(),
                subscription,
              }),
          },
        ]}
        sections={[
          {
            noPanel: true,
            content: <OrganizationStatus orgStatus={subscription.orgStatus} />,
          },
          {
            visible: !!subscription.pendingChanges,
            content: (
              <OrganizationContext.Provider value={organization}>
                <PendingChanges subscription={subscription} />
              </OrganizationContext.Provider>
            ),
          },
          {
            content: (
              <CustomerOverview
                onAction={onUpdate}
                customer={subscription}
                organization={organization}
              />
            ),
          },
          {
            noPanel: true,
            content: (
              <CustomerStatsFilters
                dataType={activeDataType}
                onChange={handleStatsTypeChange}
                onDemandPeriodStart={subscription.onDemandPeriodStart}
                onDemandPeriodEnd={subscription.onDemandPeriodEnd}
                organization={organization}
              />
            ),
          },
          {
            name: 'Usage Stats',
            content: (
              <CustomerStats
                dataType={activeDataType}
                orgSlug={orgId}
                onDemandPeriodStart={subscription.onDemandPeriodStart}
                onDemandPeriodEnd={subscription.onDemandPeriodEnd}
              />
            ),
          },
          {
            noPanel: true,
            content: <CustomerMembers orgId={orgId} />,
          },
          {
            noPanel: true,
            content: <CustomerProjects orgId={orgId} />,
          },
          {
            noPanel: true,
            content: billingDetails,
          },
          {
            noPanel: true,
            content: productUsage,
          },
          {
            noPanel: true,
            content: <CustomerPolicies orgId={orgId} />,
          },
        ]}
      />
    </ErrorBoundary>
  );
}
