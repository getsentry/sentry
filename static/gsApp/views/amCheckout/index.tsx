import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
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
} from 'getsentry/views/spendLimits/utils';

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

function AMCheckout(props: Props) {
  const {
    api,
    checkoutTier,
    isLoading,
    location,
    navigate,
    organization,
    subscription,
    promotionData,
  } = props;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | boolean>(false);
  const [formData, setFormData] = useState<CheckoutFormData | null>(null);
  const [formDataForPreview, setFormDataForPreview] = useState<CheckoutFormData | null>(
    null
  );
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);
  const [nextQueryParams, setNextQueryParams] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | undefined>(undefined);
  const [previewData, setPreviewData] = useState<PreviewData | undefined>(undefined);

  const referrer = useMemo(() => {
    if (Array.isArray(location?.query?.referrer)) {
      return location?.query?.referrer[0];
    }
    return location?.query?.referrer ?? undefined;
  }, [location]);

  const checkoutSteps = useMemo(() => {
    // Do not include Payment Method and Billing Details sections for subscriptions billed through partners
    if (subscription.isSelfServePartner) {
      if (hasActiveVCFeature(organization)) {
        // Don't allow VC customers to choose Annual plans
        return [BuildYourPlan, SetSpendLimit];
      }

      return [BuildYourPlan, SetSpendLimit, ChooseYourBillingCycle];
    }
    return [BuildYourPlan, SetSpendLimit, ChooseYourBillingCycle, AddBillingInformation];
  }, [subscription.isSelfServePartner, organization]);

  const activePlan = useMemo(() => {
    if (!formData || !billingConfig) {
      return null;
    }
    const plan = billingConfig.planList.find(({id}) => id === formData.plan);
    if (!plan) {
      throw new Error('Cannot get active plan');
    }
    return plan;
  }, [formData, billingConfig]);

  const getPlan = useCallback(
    (planId: string) => {
      return billingConfig?.planList.find(({id}) => id === planId);
    },
    [billingConfig]
  );

  /**
   * Managed subscriptions need to go through Sales or Support to make
   * changes to their plan and cannot use the self-serve checkout flow
   */
  const handleRedirect = useCallback(() => {
    return navigate(normalizeUrl(`/settings/${organization.slug}/billing/overview/`));
  }, [navigate, organization.slug]);

  const getPlans = useCallback(
    (config: BillingConfig) => {
      const isTestOrg = subscription.planDetails.isTestPlan;
      if (isTestOrg) {
        const testPlans = config.planList.filter(
          plan =>
            plan.isTestPlan &&
            (plan.id.includes(config.freePlan) ||
              (plan.basePrice &&
                ((plan.billingInterval === MONTHLY &&
                  plan.contractInterval === MONTHLY) ||
                  (plan.billingInterval === ANNUAL && plan.contractInterval === ANNUAL))))
        );

        if (testPlans.length > 0) {
          return testPlans;
        }
      }
      const plans = config.planList.filter(
        plan =>
          plan.id === config.freePlan ||
          (plan.basePrice &&
            plan.userSelectable &&
            ((plan.billingInterval === MONTHLY && plan.contractInterval === MONTHLY) ||
              (plan.billingInterval === ANNUAL && plan.contractInterval === ANNUAL)))
      );

      if (plans.length === 0) {
        throw new Error('Cannot get plan options');
      }
      return plans;
    },
    [subscription.planDetails.isTestPlan]
  );

  /**
   * Default to the business plan if:
   * 1. The account has an upsell/upgrade referrer
   * 2. The subscription is free
   * 3. Or, the subscription is on a free trial
   */
  const shouldDefaultToBusiness = useCallback(() => {
    const hasUpsell = referrer?.startsWith('upgrade') || referrer?.startsWith('upsell');

    return hasUpsell || subscription.isFree || subscription.isTrial;
  }, [referrer, subscription.isFree, subscription.isTrial]);

  const getBusinessPlan = useCallback(
    (config: BillingConfig) => {
      const {planList} = config;

      return planList.find(({name, contractInterval}) => {
        return (
          name === 'Business' &&
          contractInterval === subscription?.planDetails?.contractInterval
        );
      });
    },
    [subscription?.planDetails?.contractInterval]
  );

  /**
   * Logic for initial plan:
   * 1. Default to the business plan
   * 2. Then default to the current paid plan
   * 3. Then default to an equivalent paid plan (mm2 Business -> am1 Business)
   * 4. Then default to the server default plan (Team)
   */
  const getInitialPlan = useCallback(
    (config: BillingConfig) => {
      const {planList, defaultPlan} = config;
      const initialPlan = planList.find(({id}) => id === subscription.plan);
      const businessPlan = getBusinessPlan(config);

      if (shouldDefaultToBusiness()) {
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
    },
    [
      subscription.plan,
      subscription.planDetails.name,
      subscription.planDetails?.contractInterval,
      subscription.planTier,
      checkoutTier,
      getBusinessPlan,
      shouldDefaultToBusiness,
    ]
  );

  const canComparePrices = useCallback(
    (initialPlan: Plan) => {
      return (
        // MMx event buckets are priced differently
        hasPerformance(subscription?.planDetails) &&
        subscription.planDetails.name === initialPlan.name &&
        subscription.planDetails.billingInterval === initialPlan.billingInterval
      );
    },
    [subscription?.planDetails]
  );

  const getValidData = useCallback(
    (plan: Plan, data: Omit<CheckoutFormData, 'plan'>): CheckoutFormData => {
      const {onDemandMaxSpend, onDemandBudget, addOns} = data;

      // Verify next plan data volumes before updating form data
      // finds the approximate bucket if event level does not exist
      const nextReserved = Object.fromEntries(
        Object.entries(data.reserved).map(([category, value]) => [
          category,
          getBucket({
            events: value,
            buckets: plan.planCategories[category as DataCategory],
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
    },
    [organization, subscription, checkoutTier]
  );

  /**
   * Get the current subscription plan and event volumes.
   * If not available on current tier, use the default plan.
   */
  const getInitialData = useCallback(
    (config: BillingConfig): CheckoutFormData => {
      const {onDemandMaxSpend, planDetails} = subscription;

      const initialPlan = getInitialPlan(config);

      if (!initialPlan) {
        throw new Error('Cannot get initial plan');
      }

      const canCompare = canComparePrices(initialPlan);

      // Default to the max event volume per category based on either
      // the current reserved volume or the current reserved price.
      const reserved = Object.fromEntries(
        (
          Object.entries(planDetails.planCategories) as Array<
            [DataCategory, EventBucket[]]
          >
        )
          .filter(([category, _]) => initialPlan.planCategories[category])
          .map(([category, eventBuckets]) => {
            const currentHistory = subscription.categories[category];
            // When introducing a new category before backfilling, the reserved value from the billing metric
            // history is not available, so we default to 0.
            // Skip trial volumes - don't pre-fill with trial reserved amounts
            let events = (!isTrialPlan(planDetails.id) && currentHistory?.reserved) || 0;

            if (canCompare) {
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

      const defaultReservedCategories = Object.entries(config.defaultReserved).map(
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
          ...config.defaultReserved,
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

      return getValidData(initialPlan, data);
    },
    [
      subscription,
      checkoutTier,
      organization,
      getInitialPlan,
      canComparePrices,
      getValidData,
    ]
  );

  const getFormDataForPreview = useCallback((data: CheckoutFormData) => {
    return {
      ...data,
      onDemandBudget: undefined,
      onDemandMaxSpend: undefined,
    };
  }, []);

  const fetchBillingConfig = useCallback(async () => {
    setLoading(true);
    const endpoint = `/customers/${organization.slug}/billing-config/`;

    try {
      const config = await api.requestPromise(endpoint, {
        method: 'GET',
        data: {tier: checkoutTier},
      });

      const planList = getPlans(config);
      const newBillingConfig = {...config, planList};
      const initialFormData = getInitialData(newBillingConfig);

      setBillingConfig(newBillingConfig);
      setFormData(initialFormData);
      setFormDataForPreview(getFormDataForPreview(initialFormData));
    } catch (err: any) {
      setError(err);
      setLoading(false);
      if (err.status !== 401 && err.status !== 403) {
        Sentry.captureException(err);
      }
    }

    setLoading(false);
  }, [
    api,
    organization.slug,
    checkoutTier,
    getPlans,
    getInitialData,
    getFormDataForPreview,
  ]);

  const scrollToStep = useCallback(() => {
    const hash = location?.hash;

    if (!hash) {
      return;
    }

    // Parse step number from hash like #step1, #step2, etc.
    const stepMatch = /^#step(\d+)$/.exec(hash);
    if (!stepMatch) {
      return;
    }

    const stepNumber = parseInt(stepMatch[1]!, 10);
    if (stepNumber < 1 || stepNumber > checkoutSteps.length) {
      return;
    }

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const stepElement = document.getElementById(`step${stepNumber}`);
      if (stepElement) {
        // TODO(isabella): We should calculate some offset to add to account for the sticky header (which covers the title)
        // and we will likely need to take screen size into account (steps 3 and 4 cannot have their headers at the top of the viewport unless it's a smaller screen)
        const targetScrollY = stepElement.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({top: targetScrollY, behavior: 'smooth'});
      }
    });
  }, [location?.hash, checkoutSteps.length]);

  const handleUpdate = useCallback(
    (updatedData: any) => {
      if (!formData || !activePlan) {
        return;
      }

      const data = {...formData, ...updatedData};
      const plan = getPlan(data.plan) || activePlan;
      const validData = getValidData(plan, data);
      let validPreviewData: CheckoutFormData | null = getFormDataForPreview(validData);
      if (isEqual(validPreviewData, formDataForPreview)) {
        validPreviewData = formDataForPreview;
      }

      setFormData(validData);
      setFormDataForPreview(validPreviewData);

      if (!isEqual(validData.reserved, data.reserved)) {
        Sentry.withScope(scope => {
          scope.setExtras({validData, updatedData, previous: formData});
          scope.setLevel('warning' as any);
          Sentry.captureException(new Error('Plan event levels do not match'));
        });
      }
    },
    [
      formData,
      formDataForPreview,
      activePlan,
      getPlan,
      getValidData,
      getFormDataForPreview,
    ]
  );

  // componentDidMount
  useEffect(() => {
    /**
     * Preload Stripe so it's ready when the subscription + cc form becomes
     * available. `loadStripe` ensures Stripe is not loaded multiple times
     */
    loadStripe(ConfigStore.get('getsentry.stripePublishKey')!);

    if (subscription.canSelfServe) {
      fetchBillingConfig();
    } else {
      handleRedirect();
    }

    trackGetsentryAnalytics('am_checkout.viewed', {
      organization,
      subscription,
    });

    Sentry.getReplay()?.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // componentDidUpdate - checkoutTier change
  useEffect(() => {
    if (subscription.canSelfServe) {
      fetchBillingConfig();
    } else {
      handleRedirect();
    }
  }, [checkoutTier, subscription.canSelfServe, fetchBillingConfig, handleRedirect]);

  // componentDidUpdate - location.hash change
  useEffect(() => {
    scrollToStep();
  }, [location.hash, scrollToStep]);

  // Scroll to step after billing config and form data are ready
  useEffect(() => {
    if (billingConfig && formData) {
      scrollToStep();
    }
  }, [billingConfig, formData, scrollToStep]);

  const renderSteps = useCallback(() => {
    if (!formData || !billingConfig || !activePlan) {
      return null;
    }

    const stepProps = {
      formData,
      billingConfig,
      activePlan,
      onUpdate: handleUpdate,
      organization,
      subscription,
      checkoutTier,
    };

    return checkoutSteps.map((CheckoutStep, idx) => {
      const stepNumber = idx + 1;
      return (
        <CheckoutStep
          {...stepProps}
          key={idx}
          referrer={referrer}
          stepNumber={stepNumber}
        />
      );
    });
  }, [
    formData,
    billingConfig,
    activePlan,
    handleUpdate,
    organization,
    subscription,
    checkoutTier,
    checkoutSteps,
    referrer,
  ]);

  const renderPartnerAlert = useCallback(() => {
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
  }, [subscription]);

  if (loading || isLoading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <LoadingError />;
  }

  if (!formData || !billingConfig || !formDataForPreview || !activePlan) {
    return null;
  }

  if (isSubmitted) {
    const purchasedPlanItem = invoice?.items.find(item => item.type === 'subscription');
    const basePlan = purchasedPlanItem
      ? getPlan(purchasedPlanItem.data.plan)
      : getPlan(formData.plan);

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
    activePlan,
    onUpdate: handleUpdate,
    organization,
    subscription,
    discountInfo: discountInfo ?? undefined,
  };

  const showAnnualTerms =
    subscription.contractInterval === ANNUAL || activePlan.contractInterval === ANNUAL;

  const promotionDisclaimerText =
    promotionData?.activePromotions?.[0]?.promotion.discountInfo.disclaimerText;

  const isOnSponsoredPartnerPlan =
    (subscription.partner?.isActive && subscription.isSponsored) || false;

  const renderCheckoutContent = () => (
    <Fragment>
      <CheckoutBody>
        {renderPartnerAlert()}
        <CheckoutStepsContainer data-test-id="checkout-steps">
          {renderSteps()}
        </CheckoutStepsContainer>
      </CheckoutBody>
      <SidePanel>
        <OverviewContainer>
          <Cart
            {...overviewProps}
            referrer={referrer}
            formDataForPreview={formDataForPreview}
            onSuccess={params => {
              setInvoice(params.invoice);
              setNextQueryParams(params.nextQueryParams);
              setIsSubmitted(params.isSubmitted);
              setPreviewData(params.previewData);
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
      <SentryDocumentTitle title={t('Change Subscription')} orgSlug={organization.slug} />
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
