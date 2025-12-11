import {useEffect} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import some from 'lodash/some';
import scrollToElement from 'scroll-to-element';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ConfigStore from 'sentry/stores/configStore';
import type {DataCategory} from 'sentry/types/core';
import {DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {
  fetchMutation,
  setApiQueryData,
  useApiQuery,
  useMutation,
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
import CancelSubscriptionAction from 'admin/components/cancelSubscriptionAction';
import triggerChangeBalanceModal from 'admin/components/changeBalanceAction';
import triggerChangeDatesModal from 'admin/components/changeDatesAction';
import triggerGoogleDomainModal from 'admin/components/changeGoogleDomainAction';
import triggerChangePlanAction from 'admin/components/changePlanAction';
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
import {CustomerStatsFilters} from 'admin/components/customers/customerStatsFilters';
import OrganizationStatus from 'admin/components/customers/organizationStatus';
import PendingChanges from 'admin/components/customers/pendingChanges';
import openUpdateRetentionSettingsModal from 'admin/components/customers/updateRetentionSettingsModal';
import deleteBillingMetricHistory from 'admin/components/deleteBillingMetricHistory';
import type {ActionItem, BadgeItem} from 'admin/components/detailsPage';
import DetailsPage from 'admin/components/detailsPage';
import ForkCustomerAction from 'admin/components/forkCustomer';
import triggerEndPeriodEarlyModal from 'admin/components/nextBillingPeriodAction';
import triggerProvisionSubscription from 'admin/components/provisionSubscriptionAction';
import refundVercelRequest from 'admin/components/refundVercelRequestModal';
import SelectableContainer from 'admin/components/selectableContainer';
import SendWeeklyEmailAction from 'admin/components/sendWeeklyEmailAction';
import SponsorshipAction from 'admin/components/sponsorshipAction';
import SuspendAccountAction from 'admin/components/suspendAccountAction';
import {openToggleConsolePlatformsModal} from 'admin/components/toggleConsolePlatformsModal';
import toggleSpendAllocationModal from 'admin/components/toggleSpendAllocationModal';
import TrialSubscriptionAction from 'admin/components/trialSubscriptionAction';
import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import type {BilledDataCategoryInfo, BillingConfig, Subscription} from 'getsentry/types';
import {
  hasActiveVCFeature,
  isBizPlanFamily,
  isUnlimitedReserved,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
} from 'getsentry/utils/dataCategory';

const DEFAULT_ERROR_MESSAGE = 'Unable to update the customer account';

function makeSubscriptionQueryKey(orgId: string): ApiQueryKey {
  return [`/customers/${orgId}/`];
}

function makeOrganizationQueryKey(orgId: string): ApiQueryKey {
  return [`/organizations/${orgId}/`, {query: {detailed: 0, include_feature_flags: 1}}];
}

function makeBillingConfigQueryKey(orgId: string): ApiQueryKey {
  return [`/customers/${orgId}/billing-config/?tier=all`];
}

export default function CustomerDetails() {
  const {orgId} = useParams<{orgId: string}>();
  const location = useLocation();
  const navigate = useNavigate();

  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const SUBSCRIPTION_QUERY_KEY = makeSubscriptionQueryKey(orgId);
  const ORGANIZATION_QUERY_KEY = makeOrganizationQueryKey(orgId);
  const BILLING_CONFIG_QUERY_KEY = makeBillingConfigQueryKey(orgId);
  const {
    data: subscription,
    refetch: refetchSubscription,
    isError: isErrorSubscription,
    isPending: isPendingSubscription,
  } = useApiQuery<Subscription>(SUBSCRIPTION_QUERY_KEY, {staleTime: Infinity});
  const {
    data: organization,
    refetch: refetchOrganization,
    isError: isErrorOrganization,
    isPending: isPendingOrganization,
  } = useApiQuery<Organization>(ORGANIZATION_QUERY_KEY, {staleTime: Infinity});
  const {
    data: billingConfig,
    refetch: refetchBillingConfig,
    isError: isErrorBillingConfig,
    isPending: isPendingBillingConfig,
  } = useApiQuery<BillingConfig>(BILLING_CONFIG_QUERY_KEY, {staleTime: Infinity});

  useEffect(() => {
    if (location.query.dataType) {
      scrollToElement('#stats-filter');
    }
  });

  const onUpdateMutation = useMutation({
    mutationFn: (params: Record<string, any>) =>
      api.requestPromise(`/customers/${orgId}/`, {
        method: 'PUT',
        data: params,
      }),
    onMutate: () => addLoadingMessage('Saving changes\u2026'),
    onSuccess: (data, variables, _) => {
      addSuccessMessage(
        data.message ??
          `Customer account has been updated with ${JSON.stringify(variables)}.`
      );
      setApiQueryData(queryClient, SUBSCRIPTION_QUERY_KEY, data);
    },
    onError: (error: RequestError) => {
      if (error.status === 400 || error.status === 402) {
        const errors = Object.values(error.responseJSON || {});
        const err = errors.length && errors[0];

        const message =
          typeof err === 'string'
            ? err
            : Array.isArray(err) && err.length && err[0]
              ? err[0]
              : DEFAULT_ERROR_MESSAGE;

        addErrorMessage(message);
      } else {
        addErrorMessage(DEFAULT_ERROR_MESSAGE);
      }
    },
  });

  const onGenerateSpikeProjectionsMutation = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: `/_admin/${orgId}/queue-spike-projection/`,
        method: 'POST',
      }),
    onSuccess: () => {
      addSuccessMessage('Queued spike projection generation task.');
    },
    onError: (error: RequestError) => {
      addErrorMessage(error.message);
    },
  });

  const reloadData = () => {
    refetchSubscription();
    refetchOrganization();
    refetchBillingConfig();
  };

  if (isPendingSubscription || isPendingOrganization || isPendingBillingConfig) {
    return <LoadingIndicator />;
  }

  if (isErrorSubscription || isErrorOrganization || isErrorBillingConfig) {
    return <LoadingError onRetry={reloadData} />;
  }

  if (subscription === null || organization === null || billingConfig === null) {
    return null;
  }

  const activeDataType =
    (location.query.dataType as DataCategoryExact) ?? DataCategoryExact.ERROR;

  const userPermissions = ConfigStore.get('user')?.permissions;

  const isBillingAdmin = !!userPermissions?.has?.('billing.admin');

  const hasProvisionPermission = !!userPermissions?.has?.('billing.provision');

  const isPolicyAdmin = !!userPermissions?.has?.('policies.admin');

  const giftCategories = (): Partial<
    Record<
      DataCategory,
      {
        categoryInfo: BilledDataCategoryInfo;
        disabled: boolean;
        displayName: string;
        isReservedBudgetQuota: boolean;
        isUnlimited: boolean;
      }
    >
  > => {
    if (!subscription?.planDetails) {
      return {};
    }
    // We display all categories that are in either checkoutCategories or onDemandCategories,
    // then disable the button if the category cannot be gifted to on this particular subscription (ie. unlimited quota).
    // Categories that are not giftable in any state for the subscription are excluded (ie. plan does not include category).
    return Object.fromEntries(
      subscription.planDetails.categories
        .filter(category => {
          const categoryInfo = getCategoryInfoFromPlural(category);
          return categoryInfo?.maxAdminGift && categoryInfo.freeEventsMultiple;
        })
        .map(category => {
          const reserved = subscription.categories?.[category]?.reserved;
          const isUnlimited = isUnlimitedReserved(reserved);
          const isReservedBudgetQuota = reserved === RESERVED_BUDGET_QUOTA;

          // Check why categories are disabled
          const categoryNotExists = !subscription.categories?.[category];
          const categoryInfo = getCategoryInfoFromPlural(category);

          return [
            category,
            {
              disabled: categoryNotExists || isUnlimited || isReservedBudgetQuota,
              displayName: getPlanCategoryName({
                plan: subscription.planDetails,
                category,
                capitalize: false,
                hadCustomDynamicSampling: isReservedBudgetQuota,
              }),
              isUnlimited,
              isReservedBudgetQuota,
              categoryInfo,
            },
          ];
        })
    );
  };

  const handleStatsTypeChange = (dataType: DataCategoryExact) => {
    navigate({
      pathname: location.pathname,
      query: {...location.query, dataType},
    });
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
      addErrorMessage(`Failed to toggle spend allocations due to ${msg}`);
    } else {
      const clone = cloneDeep(subscription);
      if (clone) {
        clone.spendAllocationEnabled = spendAllocationEnabled;
        setApiQueryData(queryClient, SUBSCRIPTION_QUERY_KEY, clone);
      }
      addSuccessMessage(
        `Spend Allocations has been ${spendAllocationEnabled ? 'enabled' : 'disabled'} for organization.`
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
  const hasAdminDeleteBillingMetricHistory = orgFeatures.includes(
    'delete-billing-metric-history-admin'
  );

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
            onAction: params => onUpdateMutation.mutate({...params, canTrial: true}),
          },
          {
            key: 'endTrialEarly',
            name: 'End Trial Early',
            help: 'End the current trial immediately.',
            disabled: !subscription.isTrial,
            disabledReason: 'This account is not on on trial.',
            onAction: params => onUpdateMutation.mutate({...params, endTrialEarly: true}),
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
            onAction: params => onUpdateMutation.mutate({...params}),
          },
          {
            key: 'clearPendingChanges',
            name: 'Clear Pending Changes',
            help: 'Remove pending subscription changes.',
            visible: !!subscription.pendingChanges,
            onAction: params =>
              onUpdateMutation.mutate({...params, clearPendingChanges: true}),
          },
          {
            key: 'changeSoftCap',
            name: subscription.hasSoftCap
              ? 'Remove Legacy Soft Cap'
              : 'Add Legacy Soft Cap',
            help: subscription.hasSoftCap
              ? 'Remove the legacy soft cap from this account.'
              : 'Add legacy soft cap to this account.',
            onAction: params =>
              onUpdateMutation.mutate({...params, softCap: !subscription.hasSoftCap}),
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
              onUpdateMutation.mutate({
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
            onAction: params => onUpdateMutation.mutate({...params, cancel: true}),
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
            onAction: params =>
              onUpdateMutation.mutate({...params, terminateContract: true}),
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
              onUpdateMutation.mutate({
                ...params,
                onDemandInvoiced: !subscription.onDemandInvoiced,
              }),
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
              onUpdateMutation.mutate({suspended: true, suspensionReason}),
          },
          {
            key: 'unsuspendAccount',
            name: 'Unsuspend Account',
            help: 'Remove the suspension on this account.',
            visible: subscription.isSuspended,
            onAction: params => onUpdateMutation.mutate({...params, suspended: false}),
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
                  {...deps}
                />
              ),
            },
            onAction: params => onUpdateMutation.mutate({...params}),
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
            onAction: params => onUpdateMutation.mutate({...params}),
          },
          {
            key: 'changeDates',
            name: 'Change Dates',
            // TODO(billing): Should we start calling On-Demand periods "Pay-as-you-go" periods?
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
              (subscription.partner?.isActive || !subscription.paymentSource?.last4),
            disabledReason: subscription.partner?.isActive
              ? 'This account is managed by a third-party.'
              : 'No payment method on file.',
            skipConfirmModal: true,
            onAction: () =>
              triggerChangePlanAction({
                organization,
                subscription,
                partnerPlanId: subscription.partner?.isActive
                  ? subscription.planDetails.id
                  : null,
                onSuccess: reloadData,
              }),
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
            onAction: params => onUpdateMutation.mutate({...params, orgClose: true}),
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
            onAction: params => onUpdateMutation.mutate({...params, cancel: true}),
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
                billingConfig,
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
            key: 'generateSpikeProjections',
            name: 'Generate Spike Projections',
            help: 'Generate spike projections for all eligible SKUs for all projects for the next 7 days.',
            disabled: !isBillingAdmin,
            onAction: () => onGenerateSpikeProjectionsMutation.mutate(),
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
            onAction: params => onUpdateMutation.mutate({...params}),
          },
          {
            key: 'confirmMSAUpdatedForDataConsent',
            name: 'Confirm MSA Updated for Data Consent',
            help: "Confirm that customer's MSA has been updated.",
            visible: defined(subscription.msaUpdatedForDataConsent),
            disabled: !isPolicyAdmin,
            disabledReason: 'Requires policies:admin permissions.',
            skipConfirmModal: true,
            onAction: params =>
              onUpdateMutation.mutate({...params, msaUpdatedForDataConsent: true}),
          },
          ...Object.entries(giftCategories()).map<ActionItem>(
            ([
              dataCategory,
              {displayName, disabled, isUnlimited, isReservedBudgetQuota, categoryInfo},
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
                    billedCategoryInfo={categoryInfo}
                    dataCategory={dataCategory as DataCategory}
                    subscription={subscription}
                    {...deps}
                  />
                ),
              },
              onAction: params => onUpdateMutation.mutate({...params}),
            })
          ),
          {
            key: 'addGiftBudgetAction',
            name: 'Gift to reserved budget',
            help: 'Select a reserved budget and gift it free dollars for the current billing period.',
            visible:
              (subscription.reservedBudgets?.length ?? 0) > 0 &&
              some(subscription.reservedBudgets, budget => budget.reservedBudget > 0),
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
            key: 'deleteBillingMetricHistory',
            name: 'Delete Billing Metric History',
            help: 'Delete billing metric history for a specific data category.',
            skipConfirmModal: true,
            visible: hasAdminDeleteBillingMetricHistory,
            onAction: () =>
              deleteBillingMetricHistory({
                onSuccess: reloadData,
                organization,
              }),
          },
          {
            key: 'refundVercel',
            name: 'Vercel Refund',
            help: 'Send request to Vercel to initiate a refund for a given invoice.',
            skipConfirmModal: true,
            visible: subscription.isSelfServePartner && hasActiveVCFeature(organization),
            onAction: () =>
              refundVercelRequest({
                onSuccess: reloadData,
                subscription,
              }),
          },
          {
            key: 'toggleConsolePlatforms',
            name: 'Toggle Console Platforms',
            help: 'Enable or disable a console platform for this organization.',
            skipConfirmModal: true,
            onAction: () => {
              openToggleConsolePlatformsModal({organization, onSuccess: reloadData});
            },
          },
          {
            key: 'updateRetentions',
            name: 'Update Retentions',
            help: 'Change the retention policy settings for a specific data category.',
            skipConfirmModal: true,
            onAction: () => {
              openUpdateRetentionSettingsModal({
                organization,
                subscription,
                onSuccess: reloadData,
              });
            },
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
              <OrganizationContext value={organization}>
                <PendingChanges subscription={subscription} />
              </OrganizationContext>
            ),
          },
          {
            content: (
              <CustomerOverview
                onAction={onUpdateMutation.mutate}
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
