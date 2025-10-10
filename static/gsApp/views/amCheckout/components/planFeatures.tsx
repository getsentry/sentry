import type React from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCheckmark, IconClose, IconLightning, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';

import {DEFAULT_TIER, UNLIMITED_RESERVED} from 'getsentry/constants';
import {PlanTier, type Plan} from 'getsentry/types';
import {
  formatReservedWithUnits,
  getAmPlanTier,
  isDeveloperPlan,
  isTeamPlanFamily,
} from 'getsentry/utils/billing';
import {
  getPlanCategoryName,
  getSingularCategoryName,
  isByteCategory,
  listDisplayNames,
} from 'getsentry/utils/dataCategory';
import {displayUnitPrice} from 'getsentry/views/amCheckout/utils';

interface PlanFeatureInfo {
  features: React.ReactNode[];
  perUnitPriceDiffs: Partial<Record<DataCategory, number>>;
  plan: Plan;
}

type PlanTierName = 'developer' | 'team' | 'business';

const COMMON_FEATURES: Partial<Record<PlanTierName, string[]>> = {
  team: [
    t('Can add event volume to subscription'),
    t('Third-party integrations'),
    t('Seer: AI debugging agent (subscription required)'),
    t('Single Sign-On'),
    t('Up to 90 day retention'),
  ],
  business: [t('Code Owners support'), t('SAML + SCIM support'), t('BAA')],
};

const FEATURES_BY_TIER: Partial<
  Record<PlanTier, Partial<Record<PlanTierName, string[]>>>
> = {
  [PlanTier.AM2]: {
    team: [t('Access to UI and Continuous Profiling')],
    business: [t('Insights (90 day lookback)')],
  },

  [PlanTier.AM3]: {
    team: [t('Access to UI and Continuous Profiling')],
    business: [t('Insights (90 day lookback)')],
  },
};

function getUserFeatureForPlan(plan: Plan) {
  // TODO(isabella): Add 1 user feature for developer plan
  if (isTeamPlanFamily(plan)) {
    return t('Unlimited users');
  }

  return '';
}

function getNonBilledLimitsForPlans(
  planOptions: Plan[],
  field: 'dashboardLimit' | 'metricDetectorLimit',
  limitName: string
) {
  const planToLimits: Record<PlanTierName, number> = {
    developer: 0,
    team: 0,
    business: 0,
  };
  const planToFeatures: Record<PlanTierName, React.ReactNode> = {
    developer: '',
    team: '',
    business: '',
  };

  let lastLimit = 0;
  planOptions.forEach(plan => {
    // TODO(isabella): Remove this once Developer is surfaced
    if (isDeveloperPlan(plan)) {
      return;
    }
    const planName = plan.name.toLowerCase() as PlanTierName;
    const limit = plan[field];

    if (limit !== lastLimit) {
      lastLimit = limit;
      planToLimits[planName] = limit;
      planToFeatures[planName] =
        limit === UNLIMITED_RESERVED
          ? tct('Unlimited [limitName]', {limitName})
          : tct('[limit] [limitName]', {limitName, limit});
    }
  });

  return planToFeatures;
}

function getIncludedQuotaForPlans(planOptions: Plan[]) {
  const planToQuotaFeatures: Record<PlanTierName, string[]> = {
    developer: [],
    team: [],
    business: [],
  };
  const lastCategoryQuotaIncluded: Partial<Record<DataCategory, number>> = {};

  planOptions.forEach((plan, planIndex) => {
    const addOnCategories = Object.values(plan.addOnCategories).flatMap(
      addOnCategory => addOnCategory.dataCategories
    );
    const planName = plan.name.toLowerCase();
    Object.entries(plan.planCategories)
      .filter(([category, _]) => !addOnCategories.includes(category as DataCategory))
      .forEach(([category, eventBuckets]) => {
        const includedBucket = eventBuckets.find(bucket => bucket.events > 0);
        if (includedBucket) {
          let reserved = includedBucket.events;
          if (isDeveloperPlan(plan)) {
            // XXX: This is a hack to override dev plan volumes for non-default tiers
            // if those volumes are lower than the volume for the next plan (Team)
            const nextPlan = planOptions[planIndex + 1];
            if (nextPlan) {
              const nextPlanBucket = nextPlan.planCategories[
                category as DataCategory
              ]?.find(bucket => bucket.events > 0);
              if (nextPlanBucket) {
                if (nextPlanBucket.events > reserved) {
                  reserved = nextPlanBucket.events;
                }
              } else {
                reserved = 0;
              }
            } else {
              reserved = 0;
            }
          }
          if (reserved > (lastCategoryQuotaIncluded[category as DataCategory] ?? 0)) {
            lastCategoryQuotaIncluded[category as DataCategory] = reserved;
            const formattedReserved = formatReservedWithUnits(
              reserved,
              category as DataCategory,
              {
                isAbbreviated: true,
              }
            );
            const pluralCategoryName = getPlanCategoryName({
              plan,
              category: category as DataCategory,
              capitalize: false,
            });
            const singularCategoryName = getSingularCategoryName({
              plan,
              category: category as DataCategory,
              capitalize: false,
            });
            const formattedCategory = isByteCategory(category as DataCategory)
              ? `of ${pluralCategoryName}`
              : reserved === 1
                ? singularCategoryName
                : pluralCategoryName;
            planToQuotaFeatures[planName as keyof typeof planToQuotaFeatures].push(
              `${formattedReserved} ${formattedCategory}`
            );
          }
        }
      });
  });

  return planToQuotaFeatures;
}

function getFeaturesForPlan({
  plan,
  quotaFeatures,
  dashboardsFeatures,
  metricAlertsFeatures,
}: {
  dashboardsFeatures: Record<PlanTierName, React.ReactNode>;
  metricAlertsFeatures: Record<PlanTierName, React.ReactNode>;
  plan: Plan;
  quotaFeatures: Record<PlanTierName, string[]>;
}) {
  const planName = plan.name.toLowerCase() as PlanTierName;
  const userFeature = getUserFeatureForPlan(plan);
  const dashboardFeature = dashboardsFeatures[planName];
  const metricAlertFeature = metricAlertsFeatures[planName];
  const tier = getAmPlanTier(plan.id);
  const tierSpecificFeatures = tier ? (FEATURES_BY_TIER[tier]?.[planName] ?? []) : [];
  const commonFeatures = COMMON_FEATURES[planName] ?? [];
  const result: React.ReactNode[] = [];

  if (userFeature) {
    result.push(userFeature);
  }

  result.push(...quotaFeatures[planName]);

  if (dashboardFeature) {
    result.push(dashboardFeature);
  }
  if (metricAlertFeature) {
    result.push(metricAlertFeature);
  }
  result.push(...tierSpecificFeatures, ...commonFeatures);
  return result;
}

function FeatureItem({
  feature,
  isIncluded,
}: {
  feature: React.ReactNode;
  isIncluded: boolean;
}) {
  return (
    <FeatureItemContainer isIncluded={isIncluded} align="start" gap="md">
      <Container padding="0">
        {isIncluded ? (
          <IconCheckmark size="sm" color="success" />
        ) : (
          <IconClose size="sm" color="gray300" />
        )}
      </Container>
      <Text variant={isIncluded ? 'primary' : 'muted'}>{feature}</Text>
    </FeatureItemContainer>
  );
}

function PlanFeatures({
  planOptions,
  activePlan,
}: {
  activePlan: Plan;
  planOptions: Plan[];
}) {
  const planToFeatures: PlanFeatureInfo[] = [];
  let activePlanIndex = 0;

  const quotaFeatures = getIncludedQuotaForPlans(planOptions);
  const dashboardsFeatures = getNonBilledLimitsForPlans(
    planOptions,
    'dashboardLimit',
    t('custom dashboards')
  );
  const metricAlertsFeatures = getNonBilledLimitsForPlans(
    planOptions,
    'metricDetectorLimit',
    t('metric alerts')
  );

  const currentTier = getAmPlanTier(activePlan.id);

  planOptions.forEach((planOption, index) => {
    const priorPlan = index > 0 ? planOptions[index - 1] : null;
    const featureList = getFeaturesForPlan({
      plan: planOption,
      quotaFeatures,
      dashboardsFeatures,
      metricAlertsFeatures,
    });

    const perUnitPriceDiffs =
      !priorPlan || priorPlan?.basePrice === 0
        ? {}
        : Object.entries(planOption.planCategories ?? {}).reduce(
            (acc, [category, eventBuckets]) => {
              const priorPlanEventBuckets =
                priorPlan?.planCategories[category as DataCategory];
              const currentStartingPrice = eventBuckets[1]?.onDemandPrice ?? 0;
              const priorStartingPrice = priorPlanEventBuckets?.[1]?.onDemandPrice ?? 0;
              const perUnitPriceDiff = currentStartingPrice - priorStartingPrice;
              if (perUnitPriceDiff > 0) {
                acc[category as DataCategory] = perUnitPriceDiff;
              }
              return acc;
            },
            {} as Partial<Record<DataCategory, number>>
          );
    planToFeatures.push({plan: planOption, features: featureList, perUnitPriceDiffs});
    if (planOption.name.toLowerCase() === activePlan.name.toLowerCase()) {
      activePlanIndex = index;
    }
  });

  return (
    <Flex
      background="primary"
      padding="xl"
      radius="lg"
      border="primary"
      gap="xl"
      direction="column"
    >
      <Heading as="h3">
        {tct('What you get on the [planName] plan:', {
          planName: <Text underline>{activePlan.name}</Text>,
        })}
      </Heading>
      <Grid columns={{xs: '1fr', sm: `repeat(${planOptions.length}, 1fr)`}} gap="md xl">
        {planToFeatures.map(({plan, features, perUnitPriceDiffs}, planIndex) => {
          const planName = plan.name;
          const lowerCasePlanName = planName.toLowerCase();
          const isIncluded = activePlanIndex >= planIndex;
          const dataTestId = `${lowerCasePlanName}-features-${isIncluded ? 'included' : 'excluded'}`;
          return (
            <Flex
              data-test-id={dataTestId}
              key={lowerCasePlanName}
              direction="column"
              gap="md"
            >
              {features.map((feature, featureIndex) => (
                <FeatureItem
                  key={featureIndex}
                  feature={feature}
                  isIncluded={isIncluded}
                />
              ))}
              {Object.keys(perUnitPriceDiffs).length > 0 && (
                <EventPriceWarning isIncluded={isIncluded} align="start" gap="sm">
                  <Container paddingTop="xs">
                    <IconWarning size="sm" color="yellow300" />
                  </Container>
                  <Tooltip
                    title={tct('Starting at [priceDiffs] more on [planName].', {
                      priceDiffs: oxfordizeArray(
                        Object.entries(perUnitPriceDiffs).map(([category, diff]) => {
                          const formattedDiff = displayUnitPrice({cents: diff});
                          const formattedCategory = getSingularCategoryName({
                            plan,
                            category: category as DataCategory,
                            capitalize: false,
                          });
                          return `+${formattedDiff} / ${formattedCategory}`;
                        })
                      ),
                      planName,
                    })}
                  >
                    <Text as="span" size="md" variant="muted">
                      {tct('Excess usage for [categories] costs more on [planName]', {
                        categories: listDisplayNames({
                          plan,
                          categories: Object.keys(perUnitPriceDiffs) as DataCategory[],
                          shouldTitleCase: true,
                        }),
                        planName,
                      })}
                    </Text>
                  </Tooltip>
                </EventPriceWarning>
              )}
            </Flex>
          );
        })}
      </Grid>
      {currentTier !== DEFAULT_TIER && (
        <Flex gap="sm">
          <Container paddingTop="xs">
            <IconLightning size="sm" color="active" />
          </Container>
          <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/40444678490651-How-can-I-update-to-an-account-with-Logs">
            {t('Want the latest features? Learn more here')}
          </ExternalLink>
        </Flex>
      )}
    </Flex>
  );
}

export default PlanFeatures;

const EventPriceWarning = styled(Flex)<{isIncluded: boolean}>`
  opacity: ${p => (p.isIncluded ? 1 : 0.5)};
  > span {
    text-decoration: underline dotted;
    text-decoration-color: ${p => p.theme.subText};
  }
`;

const FeatureItemContainer = styled(Flex)<{isIncluded: boolean}>`
  color: ${p => p.theme.textColor};
  opacity: ${p => (p.isIncluded ? 1 : 0.5)};

  &:after {
    content: '';
    display: inline;
    min-width: ${p => p.theme.space['2xl']};
    flex: 1;
    height: 1px;
    border-top: 1px dashed ${p => p.theme.border};
    transform: translateY(${p => p.theme.space.md});
  }
`;
