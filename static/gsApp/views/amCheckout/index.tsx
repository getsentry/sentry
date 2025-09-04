import {Component, Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';
import moment from 'moment-timezone';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import LogoSentry from 'sentry/components/logoSentry';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TextOverflow from 'sentry/components/textOverflow';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import type {QueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import withSubscription from 'getsentry/components/withSubscription';
import ZendeskLink from 'getsentry/components/zendeskLink';
import {
  ANNUAL,
  MONTHLY,
  PAYG_BUSINESS_DEFAULT,
  PAYG_TEAM_DEFAULT,
} from 'getsentry/constants';
import {
  BillingType,
  CheckoutType,
  InvoiceItemType,
  OnDemandBudgetMode,
  PlanName,
  PlanTier,
  ReservedBudgetCategoryType,
  type BillingConfig,
  type EventBucket,
  type Invoice,
  type OnDemandBudgets,
  type Plan,
  type PromotionData,
  type Subscription,
} from 'getsentry/types';
import {
  hasActiveVCFeature,
  hasPartnerMigrationFeature,
  hasPerformance,
  isAmPlan,
  isBizPlanFamily,
  isNewPayingCustomer,
  isTrialPlan,
} from 'getsentry/utils/billing';
import {getCompletedOrActivePromotion} from 'getsentry/utils/promotions';
import {showSubscriptionDiscount} from 'getsentry/utils/promotionUtils';
import {loadStripe} from 'getsentry/utils/stripe';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import withPromotions from 'getsentry/utils/withPromotions';
import Cart from 'getsentry/views/amCheckout/cart';
import CheckoutOverview from 'getsentry/views/amCheckout/checkoutOverview';
import CheckoutOverviewV2 from 'getsentry/views/amCheckout/checkoutOverviewV2';
import CheckoutSuccess from 'getsentry/views/amCheckout/checkoutSuccess';
import AddBillingDetails from 'getsentry/views/amCheckout/steps/addBillingDetails';
import AddDataVolume from 'getsentry/views/amCheckout/steps/addDataVolume';
import AddPaymentMethod from 'getsentry/views/amCheckout/steps/addPaymentMethod';
import BuildYourPlan from 'getsentry/views/amCheckout/steps/checkoutV3/buildYourPlan';
import ContractSelect from 'getsentry/views/amCheckout/steps/contractSelect';
import OnDemandBudgetsStep from 'getsentry/views/amCheckout/steps/onDemandBudgets';
import OnDemandSpend from 'getsentry/views/amCheckout/steps/onDemandSpend';
import PlanSelect from 'getsentry/views/amCheckout/steps/planSelect';
import ReviewAndConfirm from 'getsentry/views/amCheckout/steps/reviewAndConfirm';
import SetPayAsYouGo from 'getsentry/views/amCheckout/steps/setPayAsYouGo';
import type {
  CheckoutFormData,
  SelectedProductData,
} from 'getsentry/views/amCheckout/types';
import {SelectableProduct} from 'getsentry/views/amCheckout/types';
import {getBucket} from 'getsentry/views/amCheckout/utils';
import {
  getTotalBudget,
  hasOnDemandBudgetsFeature,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/onDemandBudgets/utils';

// TODO: push promotion logic to subcomponents
type Props = {
  api: Client;
  checkoutTier: PlanTier;
  isError: boolean;
  isLoading: boolean;
  onToggleLegacy: (tier: string) => void;
  organization: Organization;
  queryClient: QueryClient;
  subscription: Subscription;
  isNewCheckout?: boolean;
  promotionData?: PromotionData;
} & RouteComponentProps<Record<PropertyKey, unknown>, unknown>;

type State = {
  billingConfig: BillingConfig | null;
  completedSteps: Set<number>;
  currentStep: number;
  error: Error | boolean;
  formData: CheckoutFormData | null;
  invoice: Invoice | null;
  loading: boolean;
  nextQueryParams: string[];
};

class AMCheckout extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    // TODO(am3): for now, only new customers and migrating partner customers can use the AM3 checkout flow
    if (
      props.checkoutTier === PlanTier.AM3 &&
      !props.subscription.plan.startsWith('am3') &&
      !hasPartnerMigrationFeature(props.organization)
    ) {
      props.onToggleLegacy(props.subscription.planTier);
    }
    // TODO(checkout v3): remove these checks once checkout v3 is GA'd
    if (props.location?.pathname.includes('checkout-v3') && !props.isNewCheckout) {
      browserHistory.push(`/settings/${props.organization.slug}/billing/checkout/`);
    } else if (!props.location?.pathname.includes('checkout-v3') && props.isNewCheckout) {
      browserHistory.push(`/checkout-v3/`);
    }
    let step = 1;
    if (props.location?.hash) {
      const stepMatch = /^#step(\d)$/.exec(props.location.hash);
      if (stepMatch) {
        step = parseInt(stepMatch[1]!, 10);
        if (step < 1 || step > 6) {
          step = 1;
        }
      }
    } else if (
      // skip 'Choose Your Plan' if customer is already on Business plan and they have all additional products enabled
      isBizPlanFamily(props.subscription.planDetails) &&
      props.checkoutTier === props.subscription.planTier
    ) {
      // TODO(billing): cleanup condition after backfill
      const selectedAll = props.organization.features.includes('seer-billing')
        ? props.subscription.reservedBudgets &&
          props.subscription.reservedBudgets.length > 0
          ? props.subscription.reservedBudgets.every(budget => {
              if (
                Object.values(SelectableProduct).includes(
                  budget.apiName as string as SelectableProduct
                )
              ) {
                return budget.reservedBudget > 0;
              }
              return !props.organization.features.includes(budget.billingFlag || '');
            })
          : false // don't skip before backfill
        : true; // skip if seer hasn't launched

      if (selectedAll) {
        step = 2;
      }
    }
    this.initialStep = step;
    this.state = {
      loading: true,
      error: false,
      currentStep: step,
      completedSteps: new Set(),
      formData: null,
      billingConfig: null,
      invoice: null,
      nextQueryParams: [],
    };
  }
  state: State;

  componentDidMount() {
    const {subscription, organization} = this.props;
    /**
     * Preload Stripe so it's ready when the subscription + cc form becomes
     * available. `loadStripe` ensures Stripe is not loaded multiple times
     */
    loadStripe();

    if (subscription.canSelfServe) {
      this.fetchBillingConfig();
    } else {
      this.handleRedirect();
    }

    if (organization) {
      trackGetsentryAnalytics('am_checkout.viewed', {organization, subscription});
    }
  }

  componentDidUpdate(prevProps: Props) {
    const {checkoutTier, subscription} = this.props;
    if (checkoutTier === prevProps.checkoutTier) {
      return;
    }

    if (subscription.canSelfServe) {
      this.fetchBillingConfig();
    } else {
      this.handleRedirect();
    }
  }

  readonly initialStep: number;

  get referrer(): string | undefined {
    const {location} = this.props;
    return location?.query?.referrer;
  }

  /**
   * Managed subscriptions need to go through Sales or Support to make
   * changes to their plan and cannot use the self-serve checkout flow
   */
  handleRedirect() {
    const {organization, router} = this.props;
    return router.push(normalizeUrl(`/settings/${organization.slug}/billing/overview/`));
  }

  async fetchBillingConfig() {
    const {api, organization, checkoutTier} = this.props;

    this.setState({loading: true});
    const endpoint = `/customers/${organization.slug}/billing-config/`;

    try {
      const config = await api.requestPromise(endpoint, {
        method: 'GET',
        data: {tier: checkoutTier},
      });

      const planList = this.getPaidPlans(config);
      const billingConfig = {...config, planList};
      const formData = this.getInitialData(billingConfig);

      this.setState({billingConfig, formData});
    } catch (error: any) {
      this.setState({error, loading: false});
      if (error.status !== 401 && error.status !== 403) {
        Sentry.captureException(error);
      }
    }

    this.setState({loading: false});
  }

  getPaidPlans(billingConfig: BillingConfig) {
    const paidPlans = billingConfig.planList.filter(
      plan =>
        plan.basePrice &&
        plan.userSelectable &&
        ((plan.billingInterval === MONTHLY && plan.contractInterval === MONTHLY) ||
          (plan.billingInterval === ANNUAL && plan.contractInterval === ANNUAL))
    );

    if (!paidPlans) {
      throw new Error('Cannot get plan options');
    }
    return paidPlans;
  }

  get checkoutSteps() {
    const {organization, subscription, checkoutTier, isNewCheckout} = this.props;
    const OnDemandStep = hasOnDemandBudgetsFeature(organization, subscription)
      ? OnDemandBudgetsStep
      : OnDemandSpend;

    if (isNewCheckout) {
      return [BuildYourPlan];
    }

    const preAM3Tiers = [PlanTier.AM1, PlanTier.AM2];
    const notAMTier = !isAmPlan(checkoutTier);

    if (preAM3Tiers.includes(checkoutTier) || notAMTier) {
      // Display for AM1 and AM2 tiers, and non-AM tiers  (e.g. L1)
      return [
        PlanSelect,
        AddDataVolume,
        OnDemandStep,
        ContractSelect,
        AddPaymentMethod,
        AddBillingDetails,
        ReviewAndConfirm,
      ].filter(step => !isNewCheckout || step !== ReviewAndConfirm);
    }
    // Do not include Payment Method and Billing Details sections for subscriptions billed through partners
    if (subscription.isSelfServePartner) {
      if (hasActiveVCFeature(organization)) {
        // Don't allow VC customers to choose Annual plans
        return [PlanSelect, SetPayAsYouGo, AddDataVolume, ReviewAndConfirm].filter(
          step => !isNewCheckout || step !== ReviewAndConfirm
        );
      }
      return [
        PlanSelect,
        SetPayAsYouGo,
        AddDataVolume,
        ContractSelect,
        ReviewAndConfirm,
      ].filter(step => !isNewCheckout || step !== ReviewAndConfirm);
    }

    // Display for AM3 tiers and above
    return [
      PlanSelect,
      SetPayAsYouGo,
      AddDataVolume,
      ContractSelect,
      AddPaymentMethod,
      AddBillingDetails,
      ReviewAndConfirm,
    ].filter(step => !isNewCheckout || step !== ReviewAndConfirm);
  }

  get activePlan() {
    const {formData} = this.state;
    const activePlan = formData && this.getPlan(formData.plan);

    if (!activePlan) {
      throw new Error('Cannot get active plan');
    }
    return activePlan;
  }

  getPlan(plan: string) {
    const {billingConfig} = this.state;
    return billingConfig?.planList.find(({id}) => id === plan);
  }

  /**
   * Default to the business plan if:
   * 1. The account has an upsell/upgrade referrer
   * 2. The subscription is free
   * 3. Or, the subscription is on a free trial
   */
  shouldDefaultToBusiness() {
    const {subscription} = this.props;

    const hasUpsell =
      (this.referrer?.startsWith('upgrade') || this.referrer?.startsWith('upsell')) &&
      this.initialStep === 1;

    return hasUpsell || subscription.isFree || subscription.isTrial;
  }

  getBusinessPlan(billingConfig: BillingConfig) {
    const {subscription} = this.props;
    const {planList} = billingConfig;

    return planList.find(({name, contractInterval}) => {
      return (
        name === 'Business' &&
        contractInterval === subscription?.planDetails?.contractInterval
      );
    });
  }

  /**
   * Logic for initial plan:
   * 1. Default to the business plan
   * 2. Then default to the current paid plan
   * 3. Then default to an equivalent paid plan (mm2 Business -> am1 Business)
   * 4. Then default to the server default plan (Team)
   */
  getInitialPlan(billingConfig: BillingConfig) {
    const {subscription, checkoutTier} = this.props;
    const {planList, defaultPlan} = billingConfig;
    const initialPlan = planList.find(({id}) => id === subscription.plan);

    if (this.shouldDefaultToBusiness()) {
      const plan = this.getBusinessPlan(billingConfig);
      if (plan) {
        return plan;
      }
    }

    // Current tier paid plan
    if (initialPlan) {
      return initialPlan;
    }

    // map bundle plans
    if (subscription.planDetails.name === PlanName.BUSINESS_BUNDLE) {
      return planList.find(
        p => p.name === PlanName.BUSINESS && p.contractInterval === 'monthly'
      );
    }
    if (subscription.planDetails.name === PlanName.TEAM_BUNDLE) {
      return planList.find(
        p => p.name === PlanName.TEAM && p.contractInterval === 'monthly'
      );
    }

    // find equivalent current plan for legacy
    const legacyInitialPlan =
      subscription.planTier !== checkoutTier &&
      planList.find(
        ({name, contractInterval}) =>
          name === subscription?.planDetails?.name &&
          contractInterval === subscription?.planDetails?.contractInterval
      );

    return legacyInitialPlan || planList.find(({id}) => id === defaultPlan);
  }

  canComparePrices(initialPlan: Plan) {
    const {subscription} = this.props;

    return (
      // MMx event buckets are priced differently
      hasPerformance(subscription?.planDetails) &&
      subscription.planDetails.name === initialPlan.name &&
      subscription.planDetails.billingInterval === initialPlan.billingInterval
    );
  }

  /**
   * Get the current subscription plan and event volumes.
   * If not available on current tier, use the default plan.
   */
  getInitialData(billingConfig: BillingConfig): CheckoutFormData {
    const {subscription, checkoutTier, organization} = this.props;
    const {onDemandMaxSpend, planDetails} = subscription;

    const initialPlan = this.getInitialPlan(billingConfig);

    if (!initialPlan) {
      throw new Error('Cannot get initial plan');
    }

    const canComparePrices = this.canComparePrices(initialPlan);

    // Default to the max event volume per category based on either
    // the current reserved volume or the current reserved price.
    const reserved = Object.fromEntries(
      (Object.entries(planDetails.planCategories) as Array<[DataCategory, EventBucket[]]>)
        .filter(([category, _]) => initialPlan.planCategories[category])
        .map(([category, eventBuckets]) => {
          const currentHistory = subscription.categories[category];
          // When introducing a new category before backfilling, the reserved value from the billing metric
          // history is not available, so we default to 0.
          // Skip trial volumes - don't pre-fill with trial reserved amounts
          let events = (!subscription.isTrial && currentHistory?.reserved) || 0;

          if (canComparePrices) {
            const price = getBucket({events, buckets: eventBuckets}).price;
            const eventsByPrice = getBucket({
              price,
              buckets: initialPlan.planCategories[category],
            }).events;
            events = Math.max(events, eventsByPrice);
          }
          return [category, events];
        })
    );

    const defaultReservedCategories = Object.entries(billingConfig.defaultReserved).map(
      ([k, _]) => k
    );
    // this is the customer's reserved values that overlap with
    // the categories in the new checkout plan
    // e.g. AM2 customers checking out an AM3 plan will have
    // reserved transactions in AM2 but do not need reserved transactions in AM3
    const reservedOverlapping = Object.fromEntries(
      Object.entries(reserved).filter(([k, _]) => defaultReservedCategories.includes(k))
    );

    const data = {
      reserved: {
        ...billingConfig.defaultReserved,
        ...reservedOverlapping,
      },
      ...(onDemandMaxSpend > 0 && {onDemandMaxSpend}),
      onDemandBudget: parseOnDemandBudgetsFromSubscription(subscription),
      selectedProducts: Object.values(SelectableProduct).reduce(
        (acc, product) => {
          acc[product] = {
            enabled: false,
          };
          return acc;
        },
        {} as Record<SelectableProduct, SelectedProductData>
      ),
    };

    if (
      isNewPayingCustomer(subscription, organization) &&
      checkoutTier === PlanTier.AM3
    ) {
      // TODO(isabella): Test if this behavior works as expected on older tiers
      data.onDemandMaxSpend = isBizPlanFamily(initialPlan)
        ? PAYG_BUSINESS_DEFAULT
        : PAYG_TEAM_DEFAULT;
      data.onDemandBudget = {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: data.onDemandMaxSpend,
      };
    }

    if (!isTrialPlan(subscription.plan)) {
      // don't prepopulate selected products from trial state
      subscription.reservedBudgets?.forEach(budget => {
        if (
          Object.values(SelectableProduct).includes(
            budget.apiName as string as SelectableProduct
          )
        ) {
          data.selectedProducts[budget.apiName as string as SelectableProduct] = {
            enabled: budget.reservedBudget > 0,
          };
        }
      });
    }

    return this.getValidData(initialPlan, data);
  }

  getValidData(plan: Plan, data: Omit<CheckoutFormData, 'plan'>): CheckoutFormData {
    const {subscription, organization, checkoutTier} = this.props;

    const {onDemandMaxSpend, onDemandBudget, selectedProducts} = data;

    // Verify next plan data volumes before updating form data
    // finds the approximate bucket if event level does not exist
    const nextReserved = Object.fromEntries(
      Object.entries(data.reserved).map(([category, value]) => [
        category,
        getBucket({
          events: value,
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          buckets: plan.planCategories[category],
          shouldMinimize: hasPartnerMigrationFeature(organization),
        }).events,
      ])
    );

    const onDemandSupported = plan.allowOnDemand && subscription.supportsOnDemand;

    // reset ondemand if not allowed or supported
    let newOnDemandMaxSpend = onDemandSupported ? onDemandMaxSpend : 0;
    if (typeof newOnDemandMaxSpend === 'number') {
      newOnDemandMaxSpend = Math.max(newOnDemandMaxSpend, 0);
    }

    let newOnDemandBudget: OnDemandBudgets | undefined = undefined;

    if (
      hasOnDemandBudgetsFeature(organization, subscription) ||
      checkoutTier === PlanTier.AM3
    ) {
      newOnDemandBudget =
        onDemandBudget && onDemandSupported
          ? onDemandBudget
          : {
              budgetMode: OnDemandBudgetMode.SHARED,
              sharedMaxBudget: 0,
            };

      newOnDemandMaxSpend = getTotalBudget(newOnDemandBudget);
    }

    return {
      plan: plan.id,
      onDemandMaxSpend: newOnDemandMaxSpend,
      onDemandBudget: newOnDemandBudget,
      reserved: nextReserved,
      selectedProducts,
    };
  }

  handleUpdate = (updatedData: any) => {
    const {organization, subscription, checkoutTier} = this.props;
    const {formData} = this.state;

    const data = {...formData, ...updatedData};
    const plan = this.getPlan(data.plan) || this.activePlan;
    const validData = this.getValidData(plan, data);

    this.setState({
      formData: validData,
    });

    const analyticsParams = {
      organization,
      subscription,
      plan: plan.id,
    };

    if (this.state.currentStep === 1) {
      trackGetsentryAnalytics('checkout.change_plan', analyticsParams);
    } else if (
      (checkoutTier === PlanTier.AM3 && this.state.currentStep === 2) ||
      (checkoutTier !== PlanTier.AM3 && this.state.currentStep === 3)
    ) {
      trackGetsentryAnalytics('checkout.ondemand_changed', {
        ...analyticsParams,
        cents: validData.onDemandMaxSpend || 0,
      });
    } else if (this.state.currentStep === 4) {
      trackGetsentryAnalytics('checkout.change_contract', analyticsParams);
    }

    if (!isEqual(validData.reserved, data.reserved)) {
      Sentry.withScope(scope => {
        scope.setExtras({validData, updatedData, previous: formData});
        scope.setLevel('warning' as any);
        Sentry.captureException(new Error('Plan event levels do not match'));
      });
    }
  };

  /**
   * Complete step and all previous steps
   */
  handleCompleteStep = (stepNumber: number) => {
    const {organization, subscription} = this.props;
    const previousSteps = Array.from({length: stepNumber}, (_, idx) => idx + 1);

    trackGetsentryAnalytics('checkout.click_continue', {
      organization,
      subscription,
      step_number: stepNumber,
      plan: this.activePlan.id,
      checkoutType: CheckoutType.STANDARD,
    });

    this.setState(state => ({
      currentStep: state.currentStep + 1,
      completedSteps: new Set([...state.completedSteps, ...previousSteps]),
    }));
  };

  handleEdit = (stepNumber: number) => {
    this.setState({
      currentStep: stepNumber,
    });
  };

  renderSteps() {
    const {
      organization,
      onToggleLegacy,
      subscription,
      checkoutTier,
      promotionData,
      isNewCheckout,
    } = this.props;
    const {currentStep, completedSteps, formData, billingConfig} = this.state;

    const promoClaimed = getCompletedOrActivePromotion(promotionData);

    if (!formData || !billingConfig) {
      return null;
    }

    const promotion = promoClaimed?.promotion;

    const stepProps = {
      formData,
      billingConfig,
      activePlan: this.activePlan,
      onUpdate: this.handleUpdate,
      onCompleteStep: this.handleCompleteStep,
      onEdit: this.handleEdit,
      onToggleLegacy,
      organization,
      subscription,
      checkoutTier,
      promotion,
    };

    return this.checkoutSteps.map((CheckoutStep, idx) => {
      const stepNumber = idx + 1;
      const isActive = currentStep === stepNumber;
      const isCompleted = !isActive && completedSteps.has(stepNumber);
      const prevStepCompleted = completedSteps.has(stepNumber - 1);

      return (
        <CheckoutStep
          {...stepProps}
          key={idx}
          stepNumber={stepNumber}
          isActive={isActive}
          isCompleted={isCompleted}
          prevStepCompleted={prevStepCompleted}
          referrer={this.referrer}
          isNewCheckout={isNewCheckout}
        />
      );
    });
  }

  renderPartnerAlert() {
    const {subscription} = this.props;

    if (!subscription.isSelfServePartner) {
      return null;
    }

    return (
      <Alert.Container>
        <Alert type="info">
          <PartnerAlertContent>
            <PartnerAlertTitle>
              {tct('Billing handled externally through [partnerName]', {
                partnerName: subscription.partner?.partnership.displayName,
              })}
            </PartnerAlertTitle>
            {tct(
              'Payments for this subscription are processed by [partnerName]. Please make sure your payment method is up to date on their platform to avoid service interruptions.',
              {
                partnerName: subscription.partner?.partnership.displayName,
              }
            )}
          </PartnerAlertContent>
        </Alert>
      </Alert.Container>
    );
  }

  render() {
    const {
      subscription,
      organization,
      isLoading,
      promotionData,
      checkoutTier,
      isNewCheckout,
    } = this.props;
    const {loading, error, formData, billingConfig, nextQueryParams} = this.state;

    const invoice: Invoice = {
      id: '3c9726268e4d454ebb41d444f8920e54',
      isPaid: true,
      isRefunded: false,
      isClosed: true,
      amount: 16950,
      amountBilled: 16950,
      amountRefunded: 0,
      channel: '',
      type: '',
      effectiveAt: '2025-09-03',
      periodStart: null,
      periodEnd: null,
      creditApplied: 0,
      chargeAttempts: 0,
      nextChargeAttempt: '2025-08-30T21:31:29Z',
      dateCreated: '2025-08-29T21:31:31.441751Z',
      receipt: {
        url: 'http://dev.getsentry.net:8000/organizations/new-checkout-am3/payments/3c9726268e4d454ebb41d444f8920e54/pdf/',
      },
      addressLine1: '45 fremont st',
      addressLine2: null,
      city: 'sf',
      region: 'ON',
      countryCode: 'CA',
      postalCode: 'l4z0c8',
      taxNumber: null,
      isReverseCharge: false,
      defaultTaxName: 'GST/HST',
      displayAddress: '45 fremont st\nsf, ON l4z0c8\nCanada',
      sentryTaxIds: {
        taxId: '77766 3303 RT0001',
        taxIdName: 'GST/HST Number',
      },
      customer: {
        accountBalance: 0,
        customPrice: null,
        customPricePcss: null,
        gdprDetails: null,
        id: '',
        isOverMemberLimit: false,
        isPartner: false,
        paymentSource: null,
        pendingChanges: null,
        spendAllocationEnabled: false,
        status: 'active',
        totalProjects: 0,
        name: 'new-checkout-am3',
        slug: 'new-checkout-am3',
        plan: 'am3_business',
        trialPlan: null,
        trialTier: null,
        planTier: 'am3',
        planDetails: {
          id: 'am3_business',
          name: 'Business',
          description: '',
          price: 78900,
          basePrice: 8900,
          totalPrice: 78900,
          trialPlan: null,
          maxMembers: null,
          retentionDays: 90,
          isTestPlan: false,
          userSelectable: true,
          checkoutType: CheckoutType.STANDARD,
          features: [
            'advanced-search',
            'integrations-stacktrace-link',
            'user-spend-notifications-settings',
            'span-stats',
            'continuous-profiling-stats',
            'profiling-view',
            'seer-billing',
            'profile-duration-ui',
            'session-replay',
            'profile-duration',
            'uptime-billing',
            'event-attachments',
            'performance-view',
            'monitor-seat-billing',
            'logs-billing',
            'codecov-integration',
            'crash-rate-alerts',
            'discover-basic',
            'incidents',
            'integrations-issue-basic',
            'integrations-issue-sync',
            'integrations-alert-rule',
            'integrations-chat-unfurl',
            'integrations-incident-management',
            'sso-basic',
            'weekly-reports',
            'insights-addon-modules',
            'issue-views',
            'anomaly-detection-alerts',
            'app-store-connect-multiple',
            'baa',
            'change-alerts',
            'custom-inbound-filters',
            'custom-symbol-sources',
            'data-forwarding',
            'discard-groups',
            'discover-query',
            'integrations-codeowners',
            'integrations-enterprise-alert-rule',
            'integrations-enterprise-incident-management',
            'integrations-event-hooks',
            'integrations-ticket-rules',
            'integrations-scm-multi-org',
            'rate-limits',
            'relay',
            'seer-based-priority',
            'sso-saml2',
            'team-insights',
            'team-roles',
            'extended-data-retention',
            'spans-usage-tracking',
            'am3-tier',
            'insights-initial-modules',
            'insights-addon-modules',
            'indexed-spans-extraction',
          ],
          billingInterval: 'monthly',
          contractInterval: 'monthly',
          onDemandEventPrice: 0.0375,
          allowOnDemand: true,
          reservedMinimum: 50000,
          allowAdditionalReservedEvents: false,
          categories: [
            DataCategory.ERRORS,
            DataCategory.LOG_BYTE,
            DataCategory.REPLAYS,
            DataCategory.SPANS,
            DataCategory.MONITOR_SEATS,
            DataCategory.UPTIME,
            DataCategory.ATTACHMENTS,
            DataCategory.PROFILE_DURATION,
            DataCategory.PROFILE_DURATION_UI,
            DataCategory.SEER_AUTOFIX,
            DataCategory.SEER_SCANNER,
          ],
          availableCategories: [
            DataCategory.ERRORS,
            DataCategory.LOG_BYTE,
            DataCategory.REPLAYS,
            DataCategory.SPANS,
            DataCategory.MONITOR_SEATS,
            DataCategory.UPTIME,
            DataCategory.ATTACHMENTS,
          ],
          onDemandCategories: [
            DataCategory.ERRORS,
            DataCategory.LOG_BYTE,
            DataCategory.REPLAYS,
            DataCategory.SPANS,
            DataCategory.MONITOR_SEATS,
            DataCategory.UPTIME,
            DataCategory.ATTACHMENTS,
            DataCategory.PROFILE_DURATION,
            DataCategory.PROFILE_DURATION_UI,
            DataCategory.SEER_AUTOFIX,
            DataCategory.SEER_SCANNER,
          ],
          checkoutCategories: [
            DataCategory.ERRORS,
            DataCategory.LOG_BYTE,
            DataCategory.REPLAYS,
            DataCategory.SPANS,
            DataCategory.MONITOR_SEATS,
            DataCategory.UPTIME,
            DataCategory.ATTACHMENTS,
          ],
          availableReservedBudgetTypes: {
            [ReservedBudgetCategoryType.SEER]: {
              budgetCategoryType: 'SEER',
              name: 'seer budget',
              apiName: ReservedBudgetCategoryType.SEER,
              productName: 'seer',
              productCheckoutName: 'seer AI agent',
              docLink: 'https://docs.sentry.io/pricing/quotas/manage-seer-budget/',
              isFixed: true,
              defaultBudget: 2500,
              dataCategories: [DataCategory.SEER_AUTOFIX, DataCategory.SEER_SCANNER],
              canProductTrial: true,
              billingFlag: 'seer-billing',
            },
          },
          hasOnDemandModes: false,
          planCategories: {
            [DataCategory.ERRORS]: [
              {
                events: 50000,
                unitPrice: 0.0,
                price: 0,
                onDemandPrice: 0.0,
              },
              {
                events: 100000,
                unitPrice: 0.089,
                price: 4500,
                onDemandPrice: 0.11125,
              },
              {
                events: 300000,
                unitPrice: 0.05,
                price: 14500,
                onDemandPrice: 0.0625,
              },
              {
                events: 500000,
                unitPrice: 0.05,
                price: 24500,
                onDemandPrice: 0.0625,
              },
              {
                events: 1000000,
                unitPrice: 0.03,
                price: 39500,
                onDemandPrice: 0.0375,
              },
              {
                events: 3000000,
                unitPrice: 0.03,
                price: 99500,
                onDemandPrice: 0.0375,
              },
              {
                events: 5000000,
                unitPrice: 0.03,
                price: 159500,
                onDemandPrice: 0.0375,
              },
              {
                events: 10000000,
                unitPrice: 0.03,
                price: 309500,
                onDemandPrice: 0.0375,
              },
              {
                events: 15000000,
                unitPrice: 0.026,
                price: 439500,
                onDemandPrice: 0.0325,
              },
              {
                events: 20000000,
                unitPrice: 0.026,
                price: 569500,
                onDemandPrice: 0.0325,
              },
              {
                events: 25000000,
                unitPrice: 0.024,
                price: 689500,
                onDemandPrice: 0.03,
              },
              {
                events: 30000000,
                unitPrice: 0.024,
                price: 809500,
                onDemandPrice: 0.03,
              },
              {
                events: 35000000,
                unitPrice: 0.024,
                price: 929500,
                onDemandPrice: 0.03,
              },
              {
                events: 40000000,
                unitPrice: 0.024,
                price: 1049500,
                onDemandPrice: 0.03,
              },
              {
                events: 45000000,
                unitPrice: 0.024,
                price: 1169500,
                onDemandPrice: 0.03,
              },
              {
                events: 50000000,
                unitPrice: 0.024,
                price: 1289500,
                onDemandPrice: 0.03,
              },
            ],
            logBytes: [
              {
                events: 5,
                unitPrice: 0,
                price: 0,
                onDemandPrice: 50,
              },
            ],
            replays: [
              {
                events: 50,
                unitPrice: 0.0,
                price: 0,
                onDemandPrice: 0.0,
              },
              {
                events: 5000,
                unitPrice: 0.3,
                price: 1500,
                onDemandPrice: 0.375,
              },
              {
                events: 10000,
                unitPrice: 0.28504,
                price: 2900,
                onDemandPrice: 0.3563,
              },
              {
                events: 25000,
                unitPrice: 0.28504,
                price: 7200,
                onDemandPrice: 0.3563,
              },
              {
                events: 50000,
                unitPrice: 0.28504,
                price: 14300,
                onDemandPrice: 0.3563,
              },
              {
                events: 75000,
                unitPrice: 0.28504,
                price: 21400,
                onDemandPrice: 0.3563,
              },
              {
                events: 100000,
                unitPrice: 0.28504,
                price: 28500,
                onDemandPrice: 0.3563,
              },
              {
                events: 300000,
                unitPrice: 0.25648,
                price: 79900,
                onDemandPrice: 0.3206,
              },
              {
                events: 500000,
                unitPrice: 0.25648,
                price: 131300,
                onDemandPrice: 0.3206,
              },
              {
                events: 1000000,
                unitPrice: 0.23088,
                price: 257200,
                onDemandPrice: 0.2886,
              },
              {
                events: 2000000,
                unitPrice: 0.23088,
                price: 488200,
                onDemandPrice: 0.2886,
              },
              {
                events: 3000000,
                unitPrice: 0.23088,
                price: 719200,
                onDemandPrice: 0.2886,
              },
              {
                events: 4000000,
                unitPrice: 0.23088,
                price: 950200,
                onDemandPrice: 0.2886,
              },
              {
                events: 5000000,
                unitPrice: 0.19624,
                price: 1163800,
                onDemandPrice: 0.2453,
              },
              {
                events: 6000000,
                unitPrice: 0.19624,
                price: 1360000,
                onDemandPrice: 0.2453,
              },
              {
                events: 7000000,
                unitPrice: 0.19624,
                price: 1556200,
                onDemandPrice: 0.2453,
              },
              {
                events: 8000000,
                unitPrice: 0.19624,
                price: 1752400,
                onDemandPrice: 0.2453,
              },
              {
                events: 9000000,
                unitPrice: 0.19624,
                price: 1948600,
                onDemandPrice: 0.2453,
              },
              {
                events: 10000000,
                unitPrice: 0.19624,
                price: 2144800,
                onDemandPrice: 0.2453,
              },
            ],
            spans: [
              {
                events: 5000000,
                unitPrice: 0.0,
                price: 0,
                onDemandPrice: 0.0,
              },
              {
                events: 10000000,
                unitPrice: 0.00032,
                price: 1600,
                onDemandPrice: 0.0004,
              },
              {
                events: 20000000,
                unitPrice: 0.00032,
                price: 4800,
                onDemandPrice: 0.0004,
              },
              {
                events: 50000000,
                unitPrice: 0.00032,
                price: 14400,
                onDemandPrice: 0.0004,
              },
              {
                events: 100000000,
                unitPrice: 0.00032,
                price: 30400,
                onDemandPrice: 0.0004,
              },
              {
                events: 200000000,
                unitPrice: 0.00029,
                price: 59400,
                onDemandPrice: 0.00036,
              },
              {
                events: 300000000,
                unitPrice: 0.00029,
                price: 88400,
                onDemandPrice: 0.00036,
              },
              {
                events: 400000000,
                unitPrice: 0.00029,
                price: 117400,
                onDemandPrice: 0.00036,
              },
              {
                events: 500000000,
                unitPrice: 0.00029,
                price: 146400,
                onDemandPrice: 0.00036,
              },
              {
                events: 600000000,
                unitPrice: 0.00029,
                price: 175400,
                onDemandPrice: 0.00036,
              },
              {
                events: 700000000,
                unitPrice: 0.00029,
                price: 204400,
                onDemandPrice: 0.00036,
              },
              {
                events: 800000000,
                unitPrice: 0.00029,
                price: 233400,
                onDemandPrice: 0.00036,
              },
              {
                events: 900000000,
                unitPrice: 0.00029,
                price: 262400,
                onDemandPrice: 0.00036,
              },
              {
                events: 1000000000,
                unitPrice: 0.00029,
                price: 291400,
                onDemandPrice: 0.00036,
              },
              {
                events: 2000000000,
                unitPrice: 0.00029,
                price: 581400,
                onDemandPrice: 0.00036,
              },
              {
                events: 3000000000,
                unitPrice: 0.00029,
                price: 871400,
                onDemandPrice: 0.00036,
              },
              {
                events: 4000000000,
                unitPrice: 0.00029,
                price: 1161400,
                onDemandPrice: 0.00036,
              },
              {
                events: 5000000000,
                unitPrice: 0.00029,
                price: 1451400,
                onDemandPrice: 0.00036,
              },
              {
                events: 6000000000,
                unitPrice: 0.00029,
                price: 1741400,
                onDemandPrice: 0.00036,
              },
              {
                events: 7000000000,
                unitPrice: 0.00029,
                price: 2031400,
                onDemandPrice: 0.00036,
              },
              {
                events: 8000000000,
                unitPrice: 0.00029,
                price: 2321400,
                onDemandPrice: 0.00036,
              },
              {
                events: 9000000000,
                unitPrice: 0.00029,
                price: 2611400,
                onDemandPrice: 0.00036,
              },
              {
                events: 10000000000,
                unitPrice: 0.00029,
                price: 2901400,
                onDemandPrice: 0.00036,
              },
            ],
            monitorSeats: [
              {
                events: 1,
                unitPrice: 60.0,
                price: 0,
                onDemandPrice: 78.0,
              },
            ],
            uptime: [
              {
                events: 1,
                unitPrice: 95.0,
                price: 0,
                onDemandPrice: 100.0,
              },
            ],
            attachments: [
              {
                events: 1,
                unitPrice: 0.0,
                price: 0,
                onDemandPrice: 0.0,
              },
              {
                events: 25,
                unitPrice: 25.0,
                price: 600,
                onDemandPrice: 31.25,
              },
              {
                events: 50,
                unitPrice: 25.0,
                price: 1200,
                onDemandPrice: 31.25,
              },
              {
                events: 75,
                unitPrice: 25.0,
                price: 1800,
                onDemandPrice: 31.25,
              },
              {
                events: 100,
                unitPrice: 25.0,
                price: 2400,
                onDemandPrice: 31.25,
              },
              {
                events: 200,
                unitPrice: 25.0,
                price: 4900,
                onDemandPrice: 31.25,
              },
              {
                events: 300,
                unitPrice: 25.0,
                price: 7400,
                onDemandPrice: 31.25,
              },
              {
                events: 400,
                unitPrice: 25.0,
                price: 9900,
                onDemandPrice: 31.25,
              },
              {
                events: 500,
                unitPrice: 25.0,
                price: 12400,
                onDemandPrice: 31.25,
              },
              {
                events: 600,
                unitPrice: 25.0,
                price: 14900,
                onDemandPrice: 31.25,
              },
              {
                events: 700,
                unitPrice: 25.0,
                price: 17400,
                onDemandPrice: 31.25,
              },
              {
                events: 800,
                unitPrice: 25.0,
                price: 19900,
                onDemandPrice: 31.25,
              },
              {
                events: 900,
                unitPrice: 25.0,
                price: 22400,
                onDemandPrice: 31.25,
              },
              {
                events: 1000,
                unitPrice: 25.0,
                price: 24900,
                onDemandPrice: 31.25,
              },
            ],
            profileDuration: [
              {
                events: 0,
                unitPrice: 0,
                price: 0,
                onDemandPrice: 3.15,
              },
            ],
            profileDurationUI: [
              {
                events: 0,
                unitPrice: 0,
                price: 0,
                onDemandPrice: 25.0,
              },
            ],
            seerAutofix: [
              {
                events: -2,
                unitPrice: 0,
                price: 2000,
                onDemandPrice: 100,
              },
              {
                events: 0,
                unitPrice: 0,
                price: 0,
                onDemandPrice: 100,
              },
            ],
            seerScanner: [
              {
                events: -2,
                unitPrice: 0,
                price: 0,
                onDemandPrice: 0.3,
              },
              {
                events: 0,
                unitPrice: 0,
                price: 0,
                onDemandPrice: 0.3,
              },
            ],
          },
          categoryDisplayNames: {
            errors: {
              plural: 'errors',
              singular: 'error',
            },
            logBytes: {
              plural: 'logs',
              singular: 'log',
            },
            replays: {
              plural: 'replays',
              singular: 'replay',
            },
            spans: {
              plural: 'spans',
              singular: 'span',
            },
            monitorSeats: {
              plural: 'cron monitors',
              singular: 'cron monitor',
            },
            uptime: {
              plural: 'uptime monitors',
              singular: 'uptime monitor',
            },
            attachments: {
              plural: 'attachments',
              singular: 'attachment',
            },
            profileDuration: {
              plural: 'continuous profile hours',
              singular: 'continuous profile hour',
            },
            profileDurationUI: {
              plural: 'UI profile hours',
              singular: 'UI profile hour',
            },
            seerAutofix: {
              plural: 'issue fixes',
              singular: 'issue fix',
            },
            seerScanner: {
              plural: 'issue scans',
              singular: 'issue scan',
            },
          },
          dashboardLimit: -1,
          budgetTerm: 'pay-as-you-go',
          metricDetectorLimit: -1,
        },
        isFree: false,
        isTrial: false,
        isSponsored: false,
        sponsoredType: null,
        hasDismissedTrialEndingNotice: false,
        hasDismissedForcedTrialNotice: false,
        isEnterpriseTrial: false,
        isPerformancePlanTrial: false,
        isHeroku: false,
        partner: null,
        isPastDue: false,
        isManaged: false,
        isSuspended: false,
        suspensionReason: null,
        supportsOnDemand: true,
        type: BillingType.CREDIT_CARD,
        billingInterval: 'monthly',
        billingPeriodStart: '2025-08-29',
        billingPeriodEnd: '2025-09-28',
        canCancel: true,
        cancelAtPeriodEnd: false,
        canSelfServe: true,
        totalMembers: 1,
        usedLicenses: 1,
        totalLicenses: 0,
        membersDeactivatedFromLimit: 0,
        trialEnd: null,
        lastTrialEnd: null,
        canTrial: false,
        isGracePeriod: false,
        canGracePeriod: true,
        dateJoined: '2025-08-12T15:06:12.891587Z',
        hasSoftCap: false,
        hasOverageNotificationsDisabled: false,
        isForcedTrial: false,
        isExemptFromForcedTrial: false,
        dataRetention: null,
        hadCustomDynamicSampling: false,
        isSelfServePartner: false,
        hasRestrictedIntegration: false,
        categories: {
          seerAutofix: {
            category: DataCategory.SEER_AUTOFIX,
            free: 0,
            prepaid: 0,
            usage: 0,
            reserved: 0,
            onDemandSpendUsed: 0,
            onDemandBudget: 0,
            onDemandQuantity: 0,
            trueForward: false,
            softCapType: null,
            usageExceeded: false,
            sentUsageWarning: false,
            customPrice: null,
            paygCpe: null,
            order: 15,
          },
          seerScanner: {
            category: DataCategory.SEER_SCANNER,
            free: 0,
            prepaid: 0,
            usage: 0,
            reserved: 0,
            onDemandSpendUsed: 0,
            onDemandBudget: 0,
            onDemandQuantity: 0,
            trueForward: false,
            softCapType: null,
            usageExceeded: false,
            sentUsageWarning: false,
            order: 16,
            customPrice: null,
            paygCpe: null,
          },
          errors: {
            category: DataCategory.ERRORS,
            free: 0,
            prepaid: 1000000,
            usage: 0,
            reserved: 1000000,
            onDemandSpendUsed: 0,
            onDemandBudget: 0,
            onDemandQuantity: 0,
            trueForward: false,
            softCapType: null,
            usageExceeded: false,
            sentUsageWarning: false,
            order: 1,
            customPrice: null,
            paygCpe: null,
          },
          attachments: {
            category: DataCategory.ATTACHMENTS,
            free: 0.0,
            prepaid: 75.0,
            usage: 0,
            reserved: 75.0,
            onDemandSpendUsed: 0,
            onDemandBudget: 0,
            onDemandQuantity: 0,
            trueForward: false,
            softCapType: null,
            usageExceeded: false,
            sentUsageWarning: false,
            customPrice: null,
            paygCpe: null,
            order: 10,
          },
          replays: {
            category: DataCategory.REPLAYS,
            free: 0,
            prepaid: 50000,
            usage: 0,
            reserved: 50000,
            onDemandSpendUsed: 0,
            onDemandBudget: 0,
            onDemandQuantity: 0,
            trueForward: false,
            softCapType: null,
            sentUsageWarning: false,
            usageExceeded: false,
            customPrice: null,
            paygCpe: null,
            order: 5,
          },
          monitorSeats: {
            category: DataCategory.MONITOR_SEATS,
            free: 0,
            prepaid: 1,
            usage: 0,
            reserved: 1,
            onDemandSpendUsed: 0,
            onDemandBudget: 0,
            onDemandQuantity: 0,
            trueForward: false,
            softCapType: null,
            usageExceeded: false,
            sentUsageWarning: false,
            customPrice: null,
            paygCpe: null,
            order: 8,
          },
          profileDuration: {
            category: DataCategory.PROFILE_DURATION,
            free: 0.0,
            prepaid: 0.0,
            usage: 0,
            reserved: 0.0,
            onDemandSpendUsed: 0,
            onDemandBudget: 0,
            onDemandQuantity: 0,
            trueForward: false,
            softCapType: null,
            usageExceeded: false,
            sentUsageWarning: false,
            customPrice: null,
            paygCpe: null,
            order: 11,
          },
          profileDurationUI: {
            category: DataCategory.PROFILE_DURATION_UI,
            free: 0.0,
            prepaid: 0.0,
            usage: 0,
            reserved: 0.0,
            onDemandSpendUsed: 0,
            onDemandBudget: 0,
            onDemandQuantity: 0,
            trueForward: false,
            softCapType: null,
            usageExceeded: false,
            sentUsageWarning: false,
            customPrice: null,
            paygCpe: null,
            order: 12,
          },
          spans: {
            category: DataCategory.SPANS,
            free: 0,
            prepaid: 50000000,
            usage: 0,
            reserved: 50000000,
            onDemandSpendUsed: 0,
            onDemandBudget: 0,
            onDemandQuantity: 0,
            trueForward: false,
            softCapType: null,
            usageExceeded: false,
            sentUsageWarning: false,
            customPrice: null,
            paygCpe: null,
            order: 6,
          },
          uptime: {
            category: DataCategory.UPTIME,
            free: 0,
            prepaid: 1,
            usage: 0,
            reserved: 1,
            onDemandSpendUsed: 0,
            onDemandBudget: 0,
            onDemandQuantity: 0,
            trueForward: false,
            softCapType: null,
            usageExceeded: false,
            sentUsageWarning: false,
            customPrice: null,
            paygCpe: null,
            order: 9,
          },
          logBytes: {
            category: DataCategory.LOG_BYTE,
            free: 0.0,
            prepaid: 5.0,
            usage: 0,
            reserved: 5.0,
            onDemandSpendUsed: 0,
            onDemandBudget: 0,
            onDemandQuantity: 0,
            trueForward: false,
            softCapType: null,
            usageExceeded: false,
            sentUsageWarning: false,
            customPrice: null,
            paygCpe: null,
            order: 2,
          },
        },
        onDemandBudgets: {
          budgetMode: OnDemandBudgetMode.SHARED,
          sharedMaxBudget: 30000,
          enabled: true,
          onDemandSpendUsed: 0,
        },
        contractPeriodStart: '2025-08-29',
        contractPeriodEnd: '2025-09-28',
        contractInterval: 'monthly',
        gracePeriodStart: null,
        gracePeriodEnd: null,
        isBundleEligible: false,
        onDemandDisabled: false,
        onDemandInvoiced: false,
        onDemandInvoicedManual: false,
        onDemandMaxSpend: 30000,
        onDemandSpendUsed: 0,
        onDemandPeriodStart: '2025-08-29',
        onDemandPeriodEnd: '2025-09-28',
        previousPaidPlans: ['am3_business', 'am3_business'],
        renewalDate: '2025-09-29',
        usageExceeded: false,
      },
      sender: {
        name: 'Sentry',
        address: ['45 Fremont Street, 8th Floor', 'San Francisco, CA 94105'],
      },
      stripeInvoiceID: '3c9726268e4d454ebb41d444f8920e54',
      charges: [
        {
          amount: 16950,
          isPaid: true,
          failureCode: null,
          dateCreated: '2025-08-29T21:31:29Z',
          stripeID: 'ch_2S1ZtPKaD3zFyOgN1KMZxjou',
          cardLast4: '4242',
        },
      ],
      items: [
        {
          amount: 8900,
          type: InvoiceItemType.SUBSCRIPTION,
          description: 'Subscription to Business',
          periodStart: '2025-08-29',
          periodEnd: '2025-09-28',
          data: {
            plan: 'am3_business',
          },
        },
        {
          amount: 39500,
          type: InvoiceItemType.RESERVED_ERRORS,
          description: '1,000,000 reserved errors',
          periodStart: '2025-08-29',
          periodEnd: '2025-09-28',
          data: {
            quantity: 1000000,
          },
        },
        {
          amount: 0,
          type: InvoiceItemType.RESERVED_LOG_BYTES,
          description: '5 GB reserved logs',
          periodStart: '2025-08-29',
          periodEnd: '2025-09-28',
          data: {
            quantity: 5000000000,
          },
        },
        {
          amount: 14300,
          type: InvoiceItemType.RESERVED_REPLAYS,
          description: '50,000 reserved replays',
          periodStart: '2025-08-29',
          periodEnd: '2025-09-28',
          data: {
            quantity: 50000,
          },
        },
        {
          amount: 14400,
          type: InvoiceItemType.RESERVED_SPANS,
          description: '50,000,000 reserved spans',
          periodStart: '2025-08-29',
          periodEnd: '2025-09-28',
          data: {
            quantity: 50000000,
          },
        },
        {
          amount: 0,
          type: InvoiceItemType.RESERVED_MONITOR_SEATS,
          description: '1 reserved cron monitors',
          periodStart: '2025-08-29',
          periodEnd: '2025-09-28',
          data: {
            quantity: 1,
          },
        },
        {
          amount: 0,
          type: InvoiceItemType.RESERVED_UPTIME,
          description: '1 reserved uptime monitors',
          periodStart: '2025-08-29',
          periodEnd: '2025-09-28',
          data: {
            quantity: 1,
          },
        },
        {
          amount: 1800,
          type: InvoiceItemType.RESERVED_ATTACHMENTS,
          description: '75 GB reserved attachments',
          periodStart: '2025-08-29',
          periodEnd: '2025-09-28',
          data: {
            quantity: 75000000000,
          },
        },
        {
          amount: 2000,
          type: InvoiceItemType.RESERVED_SEER_BUDGET,
          description: '$25 Seer credit',
          periodStart: '2025-08-29',
          periodEnd: '2025-09-28',
          data: {
            quantity: 1,
          },
        },
        {
          amount: -63900,
          type: InvoiceItemType.SUBSCRIPTION_CREDIT,
          description: 'Remaining credit from subscription to Business',
          periodStart: '2025-08-29',
          periodEnd: '2025-08-29',
          data: {
            plan: 'am3_business',
          },
        },
        {
          amount: 1950,
          type: InvoiceItemType.SALES_TAX,
          description: 'GST/HST',
          periodStart: '',
          periodEnd: '',
          data: {},
        },
      ],
    };

    if (loading || isLoading) {
      return <LoadingIndicator />;
    }

    if (error) {
      return <LoadingError />;
    }

    if (!formData || !billingConfig) {
      return null;
    }

    if (invoice && isNewCheckout) {
      const purchasedPlanItem = invoice.items.find(
        item => item.type === InvoiceItemType.SUBSCRIPTION
      );
      const basePlan = purchasedPlanItem
        ? this.getPlan(purchasedPlanItem.data.plan)
        : undefined;

      return (
        <FullScreenContainer isSuccessPage>
          <SentryDocumentTitle
            title={t('Checkout Completed')}
            orgSlug={organization.slug}
          />
          <FullScreenHeader>
            <HeaderContent>
              <LogoSentry />
            </HeaderContent>
          </FullScreenHeader>
          <CheckoutSuccess
            invoice={invoice}
            nextQueryParams={nextQueryParams}
            basePlan={basePlan}
          />
        </FullScreenContainer>
      );
    }

    const promotionClaimed = getCompletedOrActivePromotion(promotionData);
    const promo = promotionClaimed?.promotion;

    const discountInfo = promo?.discountInfo;
    const subscriptionDiscountInfo = showSubscriptionDiscount({
      activePlan: this.activePlan,
      discountInfo,
    });

    const overviewProps = {
      formData,
      billingConfig,
      activePlan: this.activePlan,
      onUpdate: this.handleUpdate,
      organization,
      subscription,
      discountInfo: discountInfo ?? undefined,
    };

    const showAnnualTerms =
      subscription.contractInterval === ANNUAL ||
      this.activePlan.contractInterval === ANNUAL;

    const promotionDisclaimerText =
      promotionData?.activePromotions?.[0]?.promotion.discountInfo.disclaimerText;

    const isOnSponsoredPartnerPlan =
      (subscription.partner?.isActive && subscription.isSponsored) || false;

    const ParentComponent = isNewCheckout ? FullScreenContainer : Fragment;

    return (
      <ParentComponent>
        <SentryDocumentTitle
          title={t('Change Subscription')}
          orgSlug={organization.slug}
        />
        {isNewCheckout && (
          <FullScreenHeader>
            <HeaderContent>
              <LogoSentry />
            </HeaderContent>
          </FullScreenHeader>
        )}
        {isOnSponsoredPartnerPlan && (
          <Alert.Container>
            <Alert type="info">
              {t(
                'Your promotional plan with %s ends on %s.',
                subscription.partner?.partnership.displayName,
                moment(subscription.contractPeriodEnd).format('ll')
              )}
            </Alert>
          </Alert.Container>
        )}
        {promotionDisclaimerText && (
          <Alert.Container>
            <Alert type="info">{promotionDisclaimerText}</Alert>
          </Alert.Container>
        )}
        {!isNewCheckout && (
          <SettingsPageHeader
            title="Change Subscription"
            colorSubtitle={subscriptionDiscountInfo}
            data-test-id="change-subscription"
          />
        )}
        <CheckoutContainer isNewCheckout={!!isNewCheckout}>
          <CheckoutMain>
            {isNewCheckout && (
              <BackButton
                borderless
                aria-label={t('Back to Subscription Overview')}
                onClick={() => {
                  browserHistory.push(`/settings/${organization.slug}/billing/`);
                }}
              >
                <IconArrow direction="left" />
                <span>{t('Back')}</span>
              </BackButton>
            )}
            {this.renderPartnerAlert()}
            <div data-test-id="checkout-steps">{this.renderSteps()}</div>
          </CheckoutMain>
          <SidePanel>
            <OverviewContainer isNewCheckout={!!isNewCheckout}>
              {isNewCheckout ? (
                <Cart
                  {...overviewProps}
                  referrer={this.referrer}
                  // TODO(checkout v3): we'll also need to fetch billing details but
                  // this will be done in a later PR
                  hasCompleteBillingDetails={!!subscription.paymentSource?.last4}
                  onSuccess={params => {
                    this.setState(prev => ({...prev, ...params}));
                  }}
                />
              ) : checkoutTier === PlanTier.AM3 ? (
                <CheckoutOverviewV2 {...overviewProps} />
              ) : (
                <CheckoutOverview {...overviewProps} />
              )}
              <SupportPrompt>
                {t('Have a question?')}
                <TextOverflow>
                  {tct('[help:Find an Answer] or [contact:Ask Support]', {
                    help: (
                      <ExternalLink href="https://sentry.zendesk.com/hc/en-us/categories/17135853065755-Account-Billing" />
                    ),
                    contact: <ZendeskLink subject="Billing Question" source="checkout" />,
                  })}
                </TextOverflow>
              </SupportPrompt>
            </OverviewContainer>
            <DisclaimerText>{discountInfo?.disclaimerText}</DisclaimerText>

            {subscription.canCancel && (
              <CancelSubscription>
                <LinkButton
                  to={`/settings/${organization.slug}/billing/cancel/`}
                  disabled={subscription.cancelAtPeriodEnd}
                >
                  {subscription.cancelAtPeriodEnd
                    ? t('Pending Cancellation')
                    : t('Cancel Subscription')}
                </LinkButton>
              </CancelSubscription>
            )}
            {showAnnualTerms && (
              <AnnualTerms>
                {tct(
                  `Annual subscriptions require a one-year non-cancellable commitment.
                  By using Sentry you agree to our [terms: Terms of Service].`,
                  {terms: <a href="https://sentry.io/terms/" />}
                )}
              </AnnualTerms>
            )}
          </SidePanel>
        </CheckoutContainer>
      </ParentComponent>
    );
  }
}

const FullScreenContainer = styled('div')<{isSuccessPage?: boolean}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: ${p => p.theme.background};
  ${p =>
    p.isSuccessPage &&
    css`
      min-height: 100vh;
    `}
`;

const FullScreenHeader = styled('header')`
  width: 100%;
  border-bottom: 1px solid ${p => p.theme.border};
  display: flex;
  justify-content: center;
`;

const HeaderContent = styled('div')`
  width: 100%;
  display: flex;
  justify-content: flex-start;
  padding: ${p => p.theme.space['2xl']};
  max-width: ${p => p.theme.breakpoints.xl};
`;

const BackButton = styled(Button)`
  align-self: flex-start;
  padding: 0;

  & span {
    margin-left: ${p => p.theme.space.sm};
  }
`;

const CheckoutContainer = styled('div')<{isNewCheckout: boolean}>`
  display: grid;
  gap: ${p => p.theme.space['2xl']};
  grid-template-columns: 3fr 2fr;

  @media (max-width: ${p =>
      p.isNewCheckout ? p.theme.breakpoints.md : p.theme.breakpoints.lg}) {
    grid-template-columns: auto;
  }

  ${p =>
    p.isNewCheckout &&
    css`
      max-width: ${p.theme.breakpoints.xl};
      padding: ${p.theme.space['2xl']};
    `}
`;

const SidePanel = styled('div')`
  height: max-content;
  position: sticky;
  top: 70px;
  align-self: start;
`;

/**
 * Hide overview at smaller screen sizes in old checkout
 * Bring overview to bottom at smaller screen sizes in new checkout
 * Cancel subscription button is always visible
 */
const OverviewContainer = styled('div')<{isNewCheckout: boolean}>`
  ${p =>
    !p.isNewCheckout &&
    css`
      @media (max-width: ${p.theme.breakpoints.lg}) {
        display: none;
      }
    `}
`;

const SupportPrompt = styled(Panel)`
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.xl};
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  align-items: center;
`;

const CancelSubscription = styled('div')`
  display: grid;
  justify-items: center;
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const DisclaimerText = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  text-align: center;
  margin-bottom: ${p => p.theme.space.md};
`;

const PartnerAlertContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

const PartnerAlertTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-bottom: ${p => p.theme.space.md};
`;

const AnnualTerms = styled(TextBlock)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
`;

const CheckoutMain = styled('div')``;

export default withPromotions(withApi(withOrganization(withSubscription(AMCheckout))));
