import {Component, Fragment} from 'react';
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

import withSubscription from 'getsentry/components/withSubscription';
import ZendeskLink from 'getsentry/components/zendeskLink';
import {
  ANNUAL,
  MONTHLY,
  PAYG_BUSINESS_DEFAULT,
  PAYG_TEAM_DEFAULT,
} from 'getsentry/constants';
import {OnDemandBudgetMode, PlanName, PlanTier} from 'getsentry/types';
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
  isBizPlanFamily,
  isNewPayingCustomer,
  isTrialPlan,
} from 'getsentry/utils/billing';
import {getCompletedOrActivePromotion} from 'getsentry/utils/promotions';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import withPromotions from 'getsentry/utils/withPromotions';
import Cart from 'getsentry/views/amCheckout/components/cart';
import CheckoutSuccess from 'getsentry/views/amCheckout/components/checkoutSuccess';
import AddBillingInformation from 'getsentry/views/amCheckout/steps/addBillingInfo';
import BuildYourPlan from 'getsentry/views/amCheckout/steps/buildYourPlan';
import ChooseYourBillingCycle from 'getsentry/views/amCheckout/steps/chooseYourBillingCycle';
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
  organization: Organization;
  queryClient: QueryClient;
  subscription: Subscription;
  promotionData?: PromotionData;
};

export type State = {
  billingConfig: BillingConfig | null;
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
    this.state = {
      loading: true,
      error: false,
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
    const {organization, subscription} = this.props;

    // Do not include Payment Method and Billing Details sections for subscriptions billed through partners
    if (subscription.isSelfServePartner) {
      if (hasActiveVCFeature(organization)) {
        // Don't allow VC customers to choose Annual plans
        return [BuildYourPlan, SetSpendLimit];
      }

      return [BuildYourPlan, SetSpendLimit, ChooseYourBillingCycle];
    }
    return [BuildYourPlan, SetSpendLimit, ChooseYourBillingCycle, AddBillingInformation];
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
      this.referrer?.startsWith('upgrade') || this.referrer?.startsWith('upsell');

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

    if (!isEqual(validData.reserved, data.reserved)) {
      Sentry.withScope(scope => {
        scope.setExtras({validData, updatedData, previous: formData});
        scope.setLevel('warning' as any);
        Sentry.captureException(new Error('Plan event levels do not match'));
      });
    }
  };

  renderSteps() {
    const {organization, subscription, checkoutTier} = this.props;
    const {formData, billingConfig} = this.state;

    if (!formData || !billingConfig) {
      return null;
    }

    const stepProps = {
      formData,
      billingConfig,
      activePlan: this.activePlan,
      onUpdate: this.handleUpdate,
      organization,
      subscription,
      checkoutTier,
    };

    return this.checkoutSteps.map((CheckoutStep, idx) => {
      return (
        <CheckoutStep
          {...stepProps}
          key={idx}
          referrer={this.referrer}
          stepNumber={idx + 1}
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
    const {subscription, organization, isLoading, promotionData} = this.props;
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

    if (isSubmitted) {
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
        <CheckoutBody>
          {this.renderPartnerAlert()}
          <CheckoutStepsContainer data-test-id="checkout-steps">
            {this.renderSteps()}
          </CheckoutStepsContainer>
        </CheckoutBody>
        <SidePanel>
          <OverviewContainer>
            <Cart
              {...overviewProps}
              referrer={this.referrer}
              formDataForPreview={formDataForPreview}
              onSuccess={params => {
                this.setState(prev => ({...prev, ...params}));
              }}
            />

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
        background="primary"
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

const CheckoutBody = styled('div')`
  padding: 0 ${p => p.theme.space['2xl']} ${p => p.theme.space['3xl']}
    ${p => p.theme.space['2xl']};
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    max-width: 47.5rem;
    padding-top: ${p => p.theme.space.md};
  }
`;

const SidePanel = styled('aside')`
  width: 100%;
  border-top: 1px solid ${p => p.theme.border};
  display: flex;
  flex-direction: column;
  padding: 0 ${p => p.theme.space['2xl']};
  background-color: ${p => p.theme.backgroundSecondary};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    position: sticky;
    right: 0;
    top: 6.25rem;
    max-width: 26rem;
    border-top: none;
    padding-left: ${p => p.theme.space['3xl']};
    background-color: ${p => p.theme.tokens.background.primary};
    padding-bottom: ${p => p.theme.space['3xl']};
  }
`;

/**
 * Hide overview at smaller screen sizes in old checkout
 * Bring overview to bottom at smaller screen sizes in new checkout
 * Cancel subscription button is always visible
 */
const OverviewContainer = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space['2xl']} 0;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: 0;
  }
`;

const CheckoutStepsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['3xl']};

  & > * + * {
    border-top: 1px solid ${p => p.theme.border};
    padding-top: ${p => p.theme.space['3xl']};
    margin-top: ${p => p.theme.space['3xl']};
  }
`;

export default withPromotions(withApi(withOrganization(withSubscription(AMCheckout))));
