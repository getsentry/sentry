import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {QueryObserverResult} from '@tanstack/react-query';
import isEqual from 'lodash/isEqual';
import moment from 'moment-timezone';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TextOverflow from 'sentry/components/textOverflow';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
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
  type BillingConfig,
  CheckoutType,
  type EventBucket,
  OnDemandBudgetMode,
  type OnDemandBudgets,
  type Plan,
  PlanName,
  PlanTier,
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
import CheckoutOverview from 'getsentry/views/amCheckout/checkoutOverview';
import CheckoutOverviewV2 from 'getsentry/views/amCheckout/checkoutOverviewV2';
import AddBillingDetails from 'getsentry/views/amCheckout/steps/addBillingDetails';
import AddDataVolume from 'getsentry/views/amCheckout/steps/addDataVolume';
import AddPaymentMethod from 'getsentry/views/amCheckout/steps/addPaymentMethod';
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
  promotionData?: PromotionData;
  refetch?: () => Promise<QueryObserverResult<PromotionData, unknown>>;
} & RouteComponentProps<Record<PropertyKey, unknown>, unknown>;

type State = {
  billingConfig: BillingConfig | null;
  completedSteps: Set<number>;
  currentStep: number;
  error: Error | boolean;
  formData: CheckoutFormData | null;
  loading: boolean;
};

class AMCheckout extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    // TODO(am3): for now, only new customers and migrating partner customers can use the AM3 checkout flow
    if (
      props.checkoutTier === PlanTier.AM3 &&
      !props.subscription.plan.startsWith('am3') &&
      !props.organization.features.includes('partner-billing-migration')
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
    } catch (error) {
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
    const {organization, subscription, checkoutTier} = this.props;
    const OnDemandStep = hasOnDemandBudgetsFeature(organization, subscription)
      ? OnDemandBudgetsStep
      : OnDemandSpend;

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
      ];
    }
    // Do not include Payment Method and Billing Details sections for subscriptions billed through partners
    if (subscription.isSelfServePartner) {
      if (hasActiveVCFeature(organization)) {
        // Don't allow VC customers to choose Annual plans
        return [PlanSelect, SetPayAsYouGo, AddDataVolume, ReviewAndConfirm];
      }
      return [PlanSelect, SetPayAsYouGo, AddDataVolume, ContractSelect, ReviewAndConfirm];
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
    ];
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
    const {organization, onToggleLegacy, subscription, checkoutTier, promotionData} =
      this.props;
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
        <Alert type="info" showIcon>
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
    const {subscription, organization, isLoading, promotionData, checkoutTier} =
      this.props;
    const {loading, error, formData, billingConfig} = this.state;

    if (loading || isLoading) {
      return <LoadingIndicator />;
    }

    if (error) {
      return <LoadingError />;
    }

    if (!formData || !billingConfig) {
      return null;
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

    return (
      <Fragment>
        <SentryDocumentTitle
          title={t('Change Subscription')}
          orgSlug={organization.slug}
        />
        {isOnSponsoredPartnerPlan && (
          <Alert.Container>
            <Alert type="info" showIcon>
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
            <Alert type="info" showIcon>
              {promotionDisclaimerText}
            </Alert>
          </Alert.Container>
        )}
        <SettingsPageHeader
          title="Change Subscription"
          colorSubtitle={subscriptionDiscountInfo}
          data-test-id="change-subscription"
        />

        <CheckoutContainer>
          <CheckoutMain>
            {this.renderPartnerAlert()}
            <div data-test-id="checkout-steps">{this.renderSteps()}</div>
          </CheckoutMain>
          <SidePanel>
            <OverviewContainer>
              {checkoutTier === PlanTier.AM3 ? (
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
      </Fragment>
    );
  }
}

const CheckoutContainer = styled('div')`
  display: grid;
  gap: ${space(3)};
  grid-template-columns: 58% auto;

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: auto;
  }
`;

const SidePanel = styled('div')`
  height: max-content;
  position: sticky;
  top: 70px;
  align-self: start;
`;

/**
 * Hide overview at smaller screen sizes
 * but keep cancel subscription button
 */
const OverviewContainer = styled('div')`
  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    display: none;
  }
`;

const SupportPrompt = styled(Panel)`
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
  gap: ${space(1)};
  padding: ${space(2)};
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  align-items: center;
`;

const CancelSubscription = styled('div')`
  display: grid;
  justify-items: center;
  margin-bottom: ${space(3)};
`;

const DisclaimerText = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  text-align: center;
  margin-bottom: ${space(1)};
`;

const PartnerAlertContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

const PartnerAlertTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-bottom: ${space(1)};
`;

const AnnualTerms = styled(TextBlock)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
`;

const CheckoutMain = styled('div')``;

export default withPromotions(withApi(withOrganization(withSubscription(AMCheckout))));
