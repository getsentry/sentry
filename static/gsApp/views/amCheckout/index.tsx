import {Component, Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {loadStripe} from '@stripe/stripe-js';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';
import moment from 'moment-timezone';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex, Grid, Stack} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import LogoSentry from 'sentry/components/logoSentry';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {QueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import {activateZendesk, hasZendesk} from 'sentry/utils/zendesk';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import withSubscription from 'getsentry/components/withSubscription';
import ZendeskLink from 'getsentry/components/zendeskLink';
import {
  ANNUAL,
  MONTHLY,
  PAYG_BUSINESS_DEFAULT,
  PAYG_TEAM_DEFAULT,
} from 'getsentry/constants';
import {CheckoutType, OnDemandBudgetMode, PlanName, PlanTier} from 'getsentry/types';
import type {
  BillingConfig,
  CheckoutAddOns,
  EventBucket,
  Invoice,
  OnDemandBudgets,
  Plan,
  PreviewData,
  PromotionData,
  Subscription,
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
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import withPromotions from 'getsentry/utils/withPromotions';
import Cart from 'getsentry/views/amCheckout/components/cart';
import CheckoutOverview from 'getsentry/views/amCheckout/components/checkoutOverview';
import CheckoutOverviewV2 from 'getsentry/views/amCheckout/components/checkoutOverviewV2';
import CheckoutSuccess from 'getsentry/views/amCheckout/components/checkoutSuccess';
import AddBillingDetails from 'getsentry/views/amCheckout/steps/addBillingDetails';
import AddBillingInformation from 'getsentry/views/amCheckout/steps/addBillingInfo';
import AddDataVolume from 'getsentry/views/amCheckout/steps/addDataVolume';
import AddPaymentMethod from 'getsentry/views/amCheckout/steps/addPaymentMethod';
import BuildYourPlan from 'getsentry/views/amCheckout/steps/buildYourPlan';
import ChooseYourBillingCycle from 'getsentry/views/amCheckout/steps/chooseYourBillingCycle';
import ContractSelect from 'getsentry/views/amCheckout/steps/contractSelect';
import OnDemandBudgetsStep from 'getsentry/views/amCheckout/steps/onDemandBudgets';
import OnDemandSpend from 'getsentry/views/amCheckout/steps/onDemandSpend';
import PlanSelect from 'getsentry/views/amCheckout/steps/planSelect';
import ReviewAndConfirm from 'getsentry/views/amCheckout/steps/reviewAndConfirm';
import SetPayAsYouGo from 'getsentry/views/amCheckout/steps/setPayAsYouGo';
import SetSpendLimit from 'getsentry/views/amCheckout/steps/setSpendLimit';
import type {CheckoutFormData} from 'getsentry/views/amCheckout/types';
import {getBucket} from 'getsentry/views/amCheckout/utils';
import {
  getTotalBudget,
  hasOnDemandBudgetsFeature,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/onDemandBudgets/utils';

type Props = {
  api: Client;
  checkoutTier: PlanTier;
  isError: boolean;
  isLoading: boolean;
  location: Location;
  navigate: ReactRouter3Navigate;
  onToggleLegacy: (tier: string) => void;
  organization: Organization;
  queryClient: QueryClient;
  subscription: Subscription;
  isNewCheckout?: boolean;
  promotionData?: PromotionData;
};

export type State = {
  billingConfig: BillingConfig | null;
  completedSteps: Set<number>;
  currentStep: number;
  error: Error | boolean;
  formData: CheckoutFormData | null;
  formDataForPreview: CheckoutFormData | null;
  isSubmitted: boolean;
  loading: boolean;
  nextQueryParams: string[];
  invoice?: Invoice;
  previewData?: PreviewData;
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
      // skip to the next step if all available add-ons are already enabled
      const selectedAll = Object.values(props.subscription.addOns ?? {}).every(
        addOn =>
          // add-on is enabled or not launched yet
          addOn.enabled || !addOn.isAvailable
      );

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
      formDataForPreview: null,
      billingConfig: null,
      nextQueryParams: [],
      isSubmitted: false,
    };
  }
  state: State;

  componentDidMount() {
    const {subscription, organization} = this.props;
    /**
     * Preload Stripe so it's ready when the subscription + cc form becomes
     * available. `loadStripe` ensures Stripe is not loaded multiple times
     */
    loadStripe(ConfigStore.get('getsentry.stripePublishKey')!);

    if (subscription.canSelfServe) {
      this.fetchBillingConfig();
    } else {
      this.handleRedirect();
    }

    if (organization) {
      trackGetsentryAnalytics('am_checkout.viewed', {
        organization,
        subscription,
      });
    }
    Sentry.getReplay()?.start();
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
    if (Array.isArray(location?.query?.referrer)) {
      return location?.query?.referrer[0];
    }
    return location?.query?.referrer ?? undefined;
  }

  /**
   * Managed subscriptions need to go through Sales or Support to make
   * changes to their plan and cannot use the self-serve checkout flow
   */
  handleRedirect() {
    const {organization, navigate} = this.props;
    return navigate(normalizeUrl(`/settings/${organization.slug}/billing/overview/`));
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

      const planList = this.getPlans(config);
      const billingConfig = {...config, planList};
      const formData = this.getInitialData(billingConfig);

      this.setState({
        billingConfig,
        formData,
        formDataForPreview: this.getFormDataForPreview(formData),
      });
    } catch (error: any) {
      this.setState({error, loading: false});
      if (error.status !== 401 && error.status !== 403) {
        Sentry.captureException(error);
      }
    }

    this.setState({loading: false});
  }

  getPlans(billingConfig: BillingConfig) {
    const {subscription} = this.props;
    const isTestOrg = subscription.planDetails.isTestPlan;
    if (isTestOrg) {
      const testPlans = billingConfig.planList.filter(
        plan =>
          plan.isTestPlan &&
          (plan.id.includes(billingConfig.freePlan) ||
            (plan.basePrice &&
              ((plan.billingInterval === MONTHLY && plan.contractInterval === MONTHLY) ||
                (plan.billingInterval === ANNUAL && plan.contractInterval === ANNUAL))))
      );

      if (testPlans.length > 0) {
        return testPlans;
      }
    }
    const plans = billingConfig.planList.filter(
      plan =>
        plan.id === billingConfig.freePlan ||
        (plan.basePrice &&
          plan.userSelectable &&
          ((plan.billingInterval === MONTHLY && plan.contractInterval === MONTHLY) ||
            (plan.billingInterval === ANNUAL && plan.contractInterval === ANNUAL)))
    );

    if (plans.length === 0) {
      throw new Error('Cannot get plan options');
    }
    return plans;
  }

  get checkoutSteps() {
    const {organization, subscription, checkoutTier, isNewCheckout} = this.props;
    const OnDemandStep = hasOnDemandBudgetsFeature(organization, subscription)
      ? OnDemandBudgetsStep
      : OnDemandSpend;

    if (isNewCheckout) {
      // Do not include Payment Method and Billing Details sections for subscriptions billed through partners
      if (subscription.isSelfServePartner) {
        if (hasActiveVCFeature(organization)) {
          // Don't allow VC customers to choose Annual plans
          return [BuildYourPlan, SetSpendLimit];
        }

        return [BuildYourPlan, SetSpendLimit, ChooseYourBillingCycle];
      }
      return [
        BuildYourPlan,
        SetSpendLimit,
        ChooseYourBillingCycle,
        AddBillingInformation,
      ];
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
    const businessPlan = this.getBusinessPlan(billingConfig);

    if (this.shouldDefaultToBusiness()) {
      if (businessPlan) {
        return businessPlan;
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

    // if no legacy initial plan found, we fallback to the business plan, then the default plan (usually team)
    return (
      legacyInitialPlan || businessPlan || planList.find(({id}) => id === defaultPlan)
    );
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
          let events = (!isTrialPlan(planDetails.id) && currentHistory?.reserved) || 0;

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
      addOns: Object.values(subscription.addOns ?? {})
        .filter(
          // only populate add-ons that are launched
          addOn => addOn.isAvailable
        )
        .reduce((acc, addOn) => {
          acc[addOn.apiName] = {
            // don't prepopulate add-ons from trial state
            enabled: addOn.enabled && !isTrialPlan(subscription.plan),
          };
          return acc;
        }, {} as CheckoutAddOns),
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

    return this.getValidData(initialPlan, data);
  }

  getValidData(plan: Plan, data: Omit<CheckoutFormData, 'plan'>): CheckoutFormData {
    const {subscription, organization, checkoutTier} = this.props;

    const {onDemandMaxSpend, onDemandBudget, addOns} = data;

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
      addOns,
    };
  }

  getFormDataForPreview = (formData: CheckoutFormData) => {
    return {
      ...formData,
      onDemandBudget: undefined,
      onDemandMaxSpend: undefined,
    };
  };

  handleUpdate = (updatedData: any) => {
    const {organization, subscription, checkoutTier, isNewCheckout} = this.props;
    const {formData, formDataForPreview} = this.state;

    const data = {...formData, ...updatedData};
    const plan = this.getPlan(data.plan) || this.activePlan;
    const validData = this.getValidData(plan, data);
    let validPreviewData: CheckoutFormData | null = this.getFormDataForPreview(validData);
    if (isEqual(validPreviewData, formDataForPreview)) {
      validPreviewData = formDataForPreview;
    }

    this.setState({
      formData: validData,
      formDataForPreview: validPreviewData,
    });

    const analyticsParams = {
      organization,
      subscription,
      plan: plan.id,
    };

    if (!isNewCheckout) {
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
    const {organization, subscription, isNewCheckout} = this.props;
    const previousSteps = Array.from({length: stepNumber}, (_, idx) => idx + 1);

    if (!isNewCheckout) {
      trackGetsentryAnalytics('checkout.click_continue', {
        organization,
        subscription,
        step_number: stepNumber,
        plan: this.activePlan.id,
        checkoutType: CheckoutType.STANDARD,
      });
    }

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

    // TODO(isabella): promotion logic should be pushed to subcomponents
    // clean this up after promos are live on new checkout
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
        <Alert variant="info">
          <Stack gap="md">
            <Text bold>
              {tct('Billing handled externally through [partnerName]', {
                partnerName: subscription.partner?.partnership.displayName,
              })}
            </Text>
            {tct(
              'Payments for this subscription are processed by [partnerName]. Please make sure your payment method is up to date on their platform to avoid service interruptions.',
              {
                partnerName: subscription.partner?.partnership.displayName,
              }
            )}
          </Stack>
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
    const {
      loading,
      error,
      formData,
      formDataForPreview,
      billingConfig,
      invoice,
      nextQueryParams,
      isSubmitted,
      previewData,
    } = this.state;

    if (loading || isLoading) {
      return <LoadingIndicator />;
    }

    if (error) {
      return <LoadingError />;
    }

    if (!formData || !billingConfig || !formDataForPreview) {
      return null;
    }

    if (isSubmitted && isNewCheckout) {
      const purchasedPlanItem = invoice?.items.find(item => item.type === 'subscription');
      const basePlan = purchasedPlanItem
        ? this.getPlan(purchasedPlanItem.data.plan)
        : this.getPlan(formData.plan);

      return (
        <Grid columns="1fr" rows="max-content 1fr" minHeight="100vh" background="primary">
          <SentryDocumentTitle
            title={t('Checkout Completed')}
            orgSlug={organization.slug}
          />
          <Flex width="100%" justify="center" borderBottom="primary">
            <Flex width="100%" justify="start" padding="2xl" maxWidth="1440px">
              <LogoSentry />
            </Flex>
          </Flex>
          <Flex height="100%" align="center" justify="center">
            <CheckoutSuccess
              invoice={invoice}
              nextQueryParams={nextQueryParams}
              basePlan={basePlan}
              previewData={previewData}
            />
          </Flex>
        </Grid>
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

    const renderCheckoutContent = () => (
      <Fragment>
        <CheckoutBody isNewCheckout={!!isNewCheckout}>
          {!isNewCheckout && (
            <SettingsPageHeader
              title="Change Subscription"
              colorSubtitle={subscriptionDiscountInfo}
              data-test-id="change-subscription"
            />
          )}
          {this.renderPartnerAlert()}
          <CheckoutStepsContainer
            data-test-id="checkout-steps"
            isNewCheckout={!!isNewCheckout}
          >
            {this.renderSteps()}
          </CheckoutStepsContainer>
        </CheckoutBody>
        <SidePanel isNewCheckout={!!isNewCheckout}>
          <OverviewContainer isNewCheckout={!!isNewCheckout}>
            {isNewCheckout ? (
              <Cart
                {...overviewProps}
                referrer={this.referrer}
                formDataForPreview={formDataForPreview}
                onSuccess={params => {
                  this.setState(prev => ({...prev, ...params}));
                }}
              />
            ) : checkoutTier === PlanTier.AM3 ? (
              <CheckoutOverviewV2 {...overviewProps} />
            ) : (
              <CheckoutOverview {...overviewProps} />
            )}

            <Stack padding="xl" gap="xl">
              <Flex justify="between" gap="xl" align="center">
                {t('Have a question?')}
                <Text align="right">
                  {tct('[help:Find an answer] or [contact]', {
                    help: (
                      <ExternalLink href="https://sentry.zendesk.com/hc/en-us/categories/17135853065755-Account-Billing" />
                    ),
                    contact: hasZendesk() ? (
                      <Button size="zero" priority="link" onClick={activateZendesk}>
                        <Text variant="accent">{t('ask Support')}</Text>
                      </Button>
                    ) : (
                      <ZendeskLink subject="Billing Question" source="checkout">
                        {t('ask Support')}
                      </ZendeskLink>
                    ),
                  })}
                </Text>
              </Flex>
              {/* temporarily hiding this until we have a better way to display it in new checkout */}
              {!isNewCheckout && (
                <Text size="md" align="center" variant="muted">
                  {discountInfo?.disclaimerText}
                </Text>
              )}
              {subscription.canCancel && (
                <LinkButton
                  to={`/settings/${organization.slug}/billing/cancel/`}
                  disabled={subscription.cancelAtPeriodEnd}
                  size="sm"
                >
                  {subscription.cancelAtPeriodEnd
                    ? t('Pending Cancellation')
                    : t('Cancel Subscription')}
                </LinkButton>
              )}
              {showAnnualTerms && (
                <Text size="xs" align="center" variant="muted">
                  {tct(
                    `Annual subscriptions require a one-year non-cancellable commitment. By using Sentry you agree to our [terms: Terms of Service].`,
                    {terms: <a href="https://sentry.io/terms/" />}
                  )}
                </Text>
              )}
            </Stack>
          </OverviewContainer>
        </SidePanel>
      </Fragment>
    );

    return (
      <Flex
        width="100%"
        background={isNewCheckout ? 'primary' : 'secondary'}
        justify="center"
        align="center"
        direction="column"
      >
        <SentryDocumentTitle
          title={t('Change Subscription')}
          orgSlug={organization.slug}
        />
        {isOnSponsoredPartnerPlan && (
          <Alert.Container>
            <Alert variant="info">
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
            <Alert variant="info">{promotionDisclaimerText}</Alert>
          </Alert.Container>
        )}
        {isNewCheckout && (
          <CheckoutHeader>
            <Flex width="100%" align="center" maxWidth="82rem" gap="lg" padding="lg 2xl">
              <LogoSentry height="20px" />
              <LinkButton
                to={`/settings/${organization.slug}/billing/`}
                icon={<IconChevron direction="left" />}
                size="xs"
                borderless
                onClick={() => {
                  trackGetsentryAnalytics('checkout.exit', {
                    subscription,
                    organization,
                  });
                }}
              >
                {t('Manage Subscription')}
              </LinkButton>

              <OrgSlug>{organization.slug.toUpperCase()}</OrgSlug>
            </Flex>
          </CheckoutHeader>
        )}
        {isNewCheckout ? (
          <Flex
            direction={{xs: 'column', md: 'row'}}
            gap="md 3xl"
            justify="between"
            width="100%"
            maxWidth="82rem"
            align="start"
            paddingTop="3xl"
          >
            {renderCheckoutContent()}
          </Flex>
        ) : (
          <Grid
            gap="2xl"
            width="100%"
            maxWidth="1440px"
            columns={{
              sm: 'auto',
              lg: '3fr 2fr',
            }}
          >
            {renderCheckoutContent()}
          </Grid>
        )}
      </Flex>
    );
  }
}

const CheckoutHeader = styled('header')`
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  width: 100%;
  background: ${p => p.theme.tokens.background.primary};
  border-bottom: 1px solid ${p => p.theme.border};
  display: flex;
  justify-content: center;
  gap: ${p => p.theme.space.md};
`;

const OrgSlug = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.subText};
  text-overflow: ellipsis;
  text-wrap: nowrap;
  flex: 1;
  text-align: right;
`;

const CheckoutBody = styled('div')<{isNewCheckout: boolean}>`
  ${p =>
    p.isNewCheckout
      ? css`
          padding: 0 ${p.theme.space['2xl']} ${p.theme.space['3xl']}
            ${p.theme.space['2xl']};
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          @media (min-width: ${p.theme.breakpoints.md}) {
            max-width: 47.5rem;
            padding-top: ${p.theme.space.md};
          }
        `
      : css`
          flex-basis: 0;
          flex-grow: 999;
          min-inline-size: 60%;
        `}
`;

const SidePanel = styled('aside')<{isNewCheckout: boolean}>`
  ${p =>
    p.isNewCheckout
      ? css`
          width: 100%;
          border-top: 1px solid ${p.theme.border};
          display: flex;
          flex-direction: column;
          padding: 0 ${p.theme.space['2xl']};
          background-color: ${p.theme.backgroundSecondary};

          @media (min-width: ${p.theme.breakpoints.md}) {
            position: sticky;
            right: 0;
            top: 6.25rem;
            max-width: 26rem;
            border-top: none;
            padding-left: ${p.theme.space['3xl']};
            background-color: ${p.theme.tokens.background.primary};
            padding-bottom: ${p.theme.space['3xl']};
          }
        `
      : css`
          height: max-content;
          position: sticky;
          top: 30px;
          align-self: start;
          flex-grow: 1;
          flex-basis: 25rem;
        `}
`;

/**
 * Hide overview at smaller screen sizes in old checkout
 * Bring overview to bottom at smaller screen sizes in new checkout
 * Cancel subscription button is always visible
 */
const OverviewContainer = styled('div')<{isNewCheckout: boolean}>`
  ${p =>
    p.isNewCheckout
      ? css`
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          gap: ${p.theme.space.xl};
          padding: ${p.theme.space['2xl']} 0;

          @media (min-width: ${p.theme.breakpoints.md}) {
            padding: 0;
          }
        `
      : css`
          @media (max-width: ${p.theme.breakpoints.lg}) {
            display: none;
          }
        `}
`;

const CheckoutStepsContainer = styled('div')<{isNewCheckout: boolean}>`
  ${p =>
    p.isNewCheckout &&
    css`
      display: flex;
      flex-direction: column;
      gap: ${p.theme.space['3xl']};

      & > * + * {
        border-top: 1px solid ${p.theme.border};
        padding-top: ${p.theme.space['3xl']};
        margin-top: ${p.theme.space['3xl']};
      }
    `}
`;

export default withPromotions(withApi(withOrganization(withSubscription(AMCheckout))));
