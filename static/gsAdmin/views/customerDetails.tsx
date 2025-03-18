import cloneDeep from 'lodash/cloneDeep';
import scrollToElement from 'scroll-to-element';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {DataCategory} from 'sentry/types/core';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type RequestError from 'sentry/utils/requestError/requestError';
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

type Props = DeprecatedAsyncComponent['props'] &
  RouteComponentProps<{orgId: string}, unknown>;

type State = DeprecatedAsyncComponent['state'] & {
  data: Subscription | null;
  organization: Organization | null;
};

class CustomerDetails extends DeprecatedAsyncComponent<Props, State> {
  shouldReload = true;

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.location.query.dataType) {
      scrollToElement('#stats-filter');
    }

    super.componentDidUpdate(prevProps, prevState);
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [
      ['data', `/customers/${this.props.params.orgId}/`],
      [
        'organization',
        `/organizations/${this.props.params.orgId}/`,
        {query: {detailed: 0, include_feature_flags: 1}},
      ],
    ];
  }

  get activeDataType(): DataType {
    if (Object.values(DataType).includes(this.props.location.query.dataType)) {
      return this.props.location.query.dataType as DataType;
    }

    return DataType.ERRORS;
  }

  get userPermissions() {
    return ConfigStore.get('user')?.permissions;
  }

  get isBillingAdmin() {
    return !!this.userPermissions?.has?.('billing.admin');
  }

  get hasProvisionPermission() {
    return !!this.userPermissions?.has?.('billing.provision');
  }

  get isPolicyAdmin() {
    return !!this.userPermissions?.has?.('policies.admin');
  }

  get giftCategories() {
    const {data} = this.state;

    if (data === null) {
      return {};
    }
    // Can only gift for checkout categories
    return Object.fromEntries(
      GIFT_CATEGORIES.map(category => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        const reserved = data.categories?.[category]?.reserved;
        const isUnlimited = isUnlimitedReserved(reserved);
        const isReservedBudgetQuota = reserved === RESERVED_BUDGET_QUOTA;
        return [
          category,
          {
            disabled:
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              !data.categories?.[category] ||
              !data.planDetails.checkoutCategories.includes(category) ||
              isUnlimited ||
              isReservedBudgetQuota,
            displayName: getPlanCategoryName({
              plan: data.planDetails,
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
  }

  handleStatsTypeChange = (dataType: DataType) => {
    const {location, router} = this.props;

    router.push({
      pathname: location.pathname,
      query: {...location.query, dataType},
    });
  };

  onUpdate = (params: Record<string, any>) => {
    addLoadingMessage('Saving changes\u2026');

    this.api.request(`/customers/${this.props.params.orgId}/`, {
      method: 'PUT',
      data: params,
      success: data => {
        addSuccessMessage(
          `Customer account has been updated with ${JSON.stringify(params)}.`
        );

        this.onSuccess(data);
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

  onSuccess = (data: any, callback?: () => void) => {
    this.setState({data}, callback);
  };

  onChangePlan = (params: Record<string, any>) => {
    // XXX The actual plan update queries are part of the modal action body

    if (!params.plan) {
      addErrorMessage(params.error.responseText);
      return;
    }

    // Reload data as changing a plan can cancel a previous pending plan.
    this.reloadData();
  };

  onForkCustomer = (params: Record<string, any>) => {
    if (params.error) {
      addErrorMessage(params.error.responseJSON.detail);
    } else {
      addSuccessMessage('The relocation job has started!');
    }
  };

  onChangeGoogleDomain = (params: Record<string, any>) => {
    if (params.newDomain) {
      const msg = JSON.stringify(params.newDomain);
      addSuccessMessage(`Customer account has been updated with new domain: ${msg}.`);
    } else {
      const msg = JSON.stringify(params.error.responseText);
      addErrorMessage(`Failed to update new domain due to ${msg}.`);
    }
  };

  onToggleSpendAllocation = ({
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
      const data = cloneDeep(this.state.data);
      if (data) {
        data.spendAllocationEnabled = spendAllocationEnabled;
        this.setState({data});
      }
      addSuccessMessage(
        tct('Spend Allocations has been [action] for organization.', {
          action: spendAllocationEnabled ? t('enabled') : t('disabled'),
        })
      );
    }
  };

  renderBody() {
    const {data, organization} = this.state;
    const {orgId} = this.props.params;
    const regionMap = ConfigStore.get('regions').reduce(
      (acc: any, region: any) => {
        acc[region.url] = region.name;
        return acc;
      },
      {} as Record<string, string>
    );
    const region = regionMap[organization?.links.regionUrl || 'unknown'] ?? 'unknown';

    if (data === null || organization === null) {
      return null;
    }

    const badges: BadgeItem[] = [
      {name: 'Grace Period', level: 'warning', visible: data.isGracePeriod},
      {name: 'Capacity Limit', level: 'warning', visible: data.usageExceeded},
      {
        name: 'Suspended',
        level: 'error',
        help: data.suspensionReason,
        visible: data.isSuspended,
      },
      {
        name: 'OnDemand Disabled',
        help: 'OnDemand has been disabled for this account due to payment failures',
        level: 'warning',
        visible: data.onDemandDisabled,
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
      disabled: !this.isBillingAdmin,
      disabledReason: 'Requires billing admin permissions.',
    };

    const orgFeatures = organization?.features ?? [];
    const hasAdminTestFeatures = orgFeatures.includes('add-billing-metric-usage-admin');

    const activeDataType = this.activeDataType;
    return (
      <div>
        <DetailsPage
          rootName="Customers"
          name={data.name}
          badges={badges}
          actions={[
            {
              key: 'allowTrial',
              name: 'Allow Trial',
              help: 'Allow this account to opt-in to a trial period.',
              visible: !data.canTrial && !data.isTrial,
              onAction: params => this.onUpdate({...params, canTrial: true}),
            },
            {
              key: 'endTrialEarly',
              name: 'End Trial Early',
              help: 'End the current trial immediately.',
              disabled: !data.isTrial,
              disabledReason: 'This account is not on on trial.',
              onAction: params => this.onUpdate({...params, endTrialEarly: true}),
            },
            {
              key: 'convertToSponsored',
              name: 'Convert to Sponsored',
              help: 'Convert this account to a sponsored plan (e.g. education, open source).',
              disabled: data.isPartner,
              disabledReason: 'Partner accounts cannot be put on sponsored plans',
              confirmModalOpts: {
                renderModalSpecificContent: deps => (
                  <SponsorshipAction subscription={data} {...deps} />
                ),
              },
              onAction: params => this.onUpdate({...params}),
            },
            {
              key: 'allowGrace',
              name: 'Allow Grace Period',
              help: 'Allow this account to enter a grace period upon next overage.',
              disabled: data.canGracePeriod,
              disabledReason: 'Account may already be in a grace period',
              onAction: params => this.onUpdate({...params, canGracePeriod: true}),
            },
            {
              key: 'clearPendingChanges',
              name: 'Clear Pending Changes',
              help: 'Remove pending subscription changes.',
              visible: !!data.pendingChanges,
              onAction: params => this.onUpdate({...params, clearPendingChanges: true}),
            },
            {
              key: 'changeSoftCap',
              name: data.hasSoftCap ? 'Remove Legacy Soft Cap' : 'Add Legacy Soft Cap',
              help: data.hasSoftCap
                ? 'Remove the legacy soft cap from this account.'
                : 'Add legacy soft cap to this account.',
              onAction: params => this.onUpdate({...params, softCap: !data.hasSoftCap}),
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
                  subscription: data,
                  onSuccess: () => this.reloadData(),
                }),
              ...actionRequiresBillingAdmin,
            },
            {
              key: 'changeOverageNotification',
              name: data.hasOverageNotificationsDisabled
                ? 'Enable Overage Notification'
                : 'Disable Overage Notification',
              help: data.hasOverageNotificationsDisabled
                ? 'Enable overage notifications on this account.'
                : 'Disable overage notifications on this account.',
              visible: data.hasSoftCap,
              onAction: params =>
                this.onUpdate({
                  ...params,
                  overageNotificationsDisabled: !data.hasOverageNotificationsDisabled,
                }),
              ...actionRequiresBillingAdmin,
            },
            {
              key: 'convertToSelfServe',
              name: 'Convert to self-serve',
              help: 'Cancel subscription and convert to self-serve.',
              visible: !data.isPartner && data.isFree && !data.canSelfServe,
              onAction: params => this.onUpdate({...params, cancel: true}),
              ...actionRequiresBillingAdmin,
            },
            {
              key: 'terminateContract',
              name: 'Terminate Contract',
              help: 'Terminate the contract (charges an early termination fee for contracts with 3 or more months remaining).',
              visible:
                data.contractInterval === 'annual' &&
                data.canCancel &&
                !data.cancelAtPeriodEnd,
              onAction: params => this.onUpdate({...params, terminateContract: true}),
              ...actionRequiresBillingAdmin,
            },
            {
              key: 'changeOnDemandBilling',
              name: data.onDemandInvoiced
                ? 'Disable On Demand Billing'
                : 'Enable On Demand Billing',
              help: data.onDemandInvoiced
                ? "Current on demand usage will be invoiced and the next billing period's on demand maximum will be $0."
                : "Enables separate invoices for on demand events (charged to the customer's default card).",
              visible:
                data.type === 'invoiced' &&
                !!data.paymentSource &&
                !data.onDemandInvoicedManual,
              onAction: params =>
                this.onUpdate({...params, onDemandInvoiced: !data.onDemandInvoiced}),
              ...actionRequiresBillingAdmin,
            },
            {
              key: 'suspendAccount',
              name: 'Suspend Account',
              help: 'Suspend this account for abuse.',
              visible: !data.isSuspended,
              confirmModalOpts: {
                disableConfirmButton: true,
                priority: 'danger',
                confirmText: 'Suspend Account',
                renderModalSpecificContent: deps => <SuspendAccountAction {...deps} />,
              },
              onAction: ({suspensionReason}) =>
                this.onUpdate({suspended: true, suspensionReason}),
            },
            {
              key: 'unsuspendAccount',
              name: 'Unsuspend Account',
              help: 'Remove the suspension on this account.',
              visible: data.isSuspended,
              onAction: params => this.onUpdate({...params, suspended: false}),
            },
            {
              key: 'startEnterpriseTrial',
              name: 'Start Enterprise Trial',
              help: 'Start enterprise trial (e.g. SSO, unlimited events).',
              disabled: data.isPartner || data.isEnterpriseTrial,
              disabledReason: data.isPartner
                ? 'This account is managed by a third-party.'
                : 'Already on an enterprise trial.',
              confirmModalOpts: {
                renderModalSpecificContent: deps => (
                  <TrialSubscriptionAction
                    subscription={data}
                    startEnterpriseTrial
                    canUseTrialOverride={hasAdminTestFeatures}
                    {...deps}
                  />
                ),
              },
              onAction: params => this.onUpdate({...params}),
            },
            {
              key: 'startTrial',
              name: data.isTrial ? 'Extend Trial' : 'Start Trial',
              help: 'Start or extend a trial for this account.',
              confirmModalOpts: {
                renderModalSpecificContent: deps => (
                  <TrialSubscriptionAction subscription={data} {...deps} />
                ),
              },
              onAction: params => this.onUpdate({...params}),
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
                  subscription: data,
                  onSuccess: () => this.reloadData(),
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
                  subscription: data,
                  onSuccess: () => this.reloadData(),
                }),
            },
            {
              key: 'changePlan',
              name: 'Change Plan',
              help: 'Upgrade (or downgrade) this subscription.',
              disabled:
                // Enabling admin to modify NT for partnership support
                data.partner?.partnership.id !== 'NT' &&
                (data.partner?.isActive ||
                  !data.paymentSource ||
                  !data.paymentSource.last4),
              disabledReason: data.partner?.isActive
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
                    partnerPlanId={data.partner?.isActive ? data.planDetails.id : null}
                  />
                ),
              },
              onAction: params => this.onChangePlan({...params}),
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
              onAction: params => this.onUpdate({...params, orgClose: true}),
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
              onAction: params => this.onForkCustomer({...params, cancel: true}),
            },
            {
              key: 'cancelSubscription',
              name: 'Cancel Subscription',
              help: 'Downgrade the subscription to free.',
              confirmModalOpts: {
                priority: 'danger',
                confirmText: 'Cancel Subscription',
                renderModalSpecificContent: deps => (
                  <CancelSubscriptionAction subscription={data} {...deps} />
                ),
              },
              onAction: params => this.onUpdate({...params, cancel: true}),
            },
            {
              key: 'provisionSubscription',
              name: 'Provision Subscription',
              help: 'Schedule changes to this subscription now or at a future date.',
              disabled: !this.isBillingAdmin || !this.hasProvisionPermission,
              disabledReason: this.isBillingAdmin
                ? 'Requires provisioning permissions.'
                : 'Requires billing admin permissions.',
              skipConfirmModal: true,
              onAction: () =>
                triggerProvisionSubscription({
                  orgId,
                  subscription: data,
                  canProvisionDsPlan: hasAdminTestFeatures,
                  onSuccess: () => this.reloadData(),
                }),
            },
            {
              key: 'toggleSpendAllocations',
              name: 'Toggle Spend Allocations',
              help: 'Enable or disable the spend allocation organization option.',
              disabled:
                !orgFeatures.includes('spend-allocations') &&
                !isBizPlanFamily(data.planDetails),
              disabledReason:
                'Spend Allocations can only be enabled for Business and Enterprise plans.',
              skipConfirmModal: true,
              onAction: () =>
                toggleSpendAllocationModal({
                  orgId,
                  spendAllocationEnabled: data.spendAllocationEnabled,
                  onUpdated: this.onToggleSpendAllocation,
                }),
            },
            {
              key: 'changeGoogleDomain',
              name: 'Change Google Domain',
              help: 'Swap or add a Google Domain.',
              skipConfirmModal: true,
              onAction: () =>
                triggerGoogleDomainModal({orgId, onUpdated: this.onChangeGoogleDomain}),
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
              onAction: params => this.onUpdate({...params}),
            },
            {
              key: 'confirmMSAUpdatedForDataConsent',
              name: 'Confirm MSA Updated for Data Consent',
              help: "Confirm that customer's MSA has been updated.",
              visible: defined(data.msaUpdatedForDataConsent),
              disabled: !this.isPolicyAdmin,
              disabledReason: 'Requires policies:admin permissions.',
              skipConfirmModal: true,
              onAction: params =>
                this.onUpdate({...params, msaUpdatedForDataConsent: true}),
            },
            ...Object.entries(this.giftCategories).map<ActionItem>(
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
                      subscription={data}
                      {...deps}
                    />
                  ),
                },
                onAction: params => this.onUpdate({...params}),
              })
            ),
            {
              key: 'addGiftBudgetAction',
              name: 'Gift to reserved budget',
              help: 'Select a reserved budget and gift it free dollars for the current billing period.',
              visible: data.hasReservedBudgets,
              skipConfirmModal: true,
              onAction: () => {
                addGiftBudgetAction({
                  onSuccess: () => this.reloadData(),
                  organization,
                  subscription: data,
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
                  onSuccess: () => this.reloadData(),
                  organization,
                }),
            },
            {
              key: 'testVercelApi',
              name: 'Test Vercel API',
              help: 'Send API requests to Vercel',
              skipConfirmModal: true,
              visible: data.isSelfServePartner && hasActiveVCFeature(organization),
              onAction: () =>
                testVercelApiEndpoint({
                  onSuccess: () => this.reloadData(),
                  subscription: data,
                }),
            },
          ]}
          sections={[
            {
              noPanel: true,
              content: <OrganizationStatus orgStatus={data.orgStatus} />,
            },
            {
              visible: !!data.pendingChanges,
              content: (
                <OrganizationContext.Provider value={organization}>
                  <PendingChanges subscription={data} />
                </OrganizationContext.Provider>
              ),
            },
            {
              content: (
                <CustomerOverview
                  onAction={this.onUpdate}
                  customer={data}
                  organization={organization}
                />
              ),
            },
            {
              noPanel: true,
              content: (
                <CustomerStatsFilters
                  dataType={activeDataType}
                  onChange={this.handleStatsTypeChange}
                  onDemandPeriodStart={data.onDemandPeriodStart}
                  onDemandPeriodEnd={data.onDemandPeriodEnd}
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
                  onDemandPeriodStart={data.onDemandPeriodStart}
                  onDemandPeriodEnd={data.onDemandPeriodEnd}
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
      </div>
    );
  }
}

export default CustomerDetails;
