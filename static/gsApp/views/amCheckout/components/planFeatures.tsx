import type React from 'react';
import {useMemo} from 'react';

import {Tooltip} from '@sentry/scraps/tooltip';

import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Heading, Text} from 'sentry/components/core/text';
import {
  IconAdd,
  IconCheckmark,
  IconClose,
  IconLightning,
  IconWarning,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';

import {DEFAULT_TIER, UNLIMITED_RESERVED} from 'getsentry/constants';
import {PlanTier, type Plan} from 'getsentry/types';
import {formatReservedWithUnits, getAmPlanTier} from 'getsentry/utils/billing';
import {
  getPlanCategoryName,
  getSingularCategoryName,
  isByteCategory,
  listDisplayNames,
} from 'getsentry/utils/dataCategory';
import {displayUnitPrice} from 'getsentry/views/amCheckout/utils';

// TODO(isabella): Clean up repetitive code in this component

type PlanType = 'developer' | 'team' | 'business';

type FeatureKey =
  | 'users'
  | 'sso'
  | 'retention'
  | 'integrations'
  | 'insights'
  | 'codeowners'
  | 'baa'
  | 'alerts'
  | 'dashboards'
  | 'inbound-filters'
  | 'gh-multi-org'
  | 'relay'
  | DataCategory;

type FeatureInfo = {
  /**
   * A mapping where the key is the minimum plan type needed to
   * display the feature, and the value is the display string.
   */
  displayStringMap: Partial<Record<PlanType, string>>;
  key: FeatureKey;
  displayStringPrefix?: string;
  displayStringSuffix?: string;
  excludedTiers?: PlanTier[];
};

const ORDERED_PLAN_TYPES = ['developer', 'team', 'business'];

// TODO: this will need to be updated when Developer is surfaced in checkout
const EXPANSION_PACK_FEATURES: FeatureInfo[] = [
  {
    key: 'users',
    displayStringMap: {
      team: t('Unlimited users'),
    },
  },
  {
    key: 'sso',
    displayStringMap: {
      team: t('SSO w/ GitHub and Google'),
      business: t('+ SAML and SCIM support'),
    },
  },
  {
    key: 'retention',
    displayStringMap: {
      team: t('Up to 90 day retention'),
    },
  },
  {
    key: 'integrations',
    displayStringMap: {
      developer: t('Third-party integrations'),
    },
  },
  {
    key: 'insights',
    displayStringMap: {
      team: t('Insights w/ 30 day lookback'),
      business: t('+ 13 month sampled retention'),
    },
    excludedTiers: [PlanTier.AM1],
  },
  {
    key: 'codeowners',
    displayStringMap: {
      business: t('Code Owners and ownership rules'),
    },
  },
  {
    key: 'inbound-filters',
    displayStringMap: {
      business: t('Advanced inbound filtering'),
    },
  },
  {
    key: 'gh-multi-org',
    displayStringMap: {
      business: t('Multi-org support for GitHub'),
    },
  },
  {
    key: 'baa',
    displayStringMap: {
      business: t('Business Associate Agreement'),
    },
  },
  {
    key: 'relay',
    displayStringMap: {
      business: t('Relay'),
    },
  },
];

/**
 * Returns the minimum plan type that has the feature, if any.
 */
function getMinimumPlanType({
  featureInfo,
}: {
  featureInfo: FeatureInfo;
}): PlanType | undefined {
  return (
    (Object.keys(featureInfo.displayStringMap).sort(
      (a, b) => ORDERED_PLAN_TYPES.indexOf(a) - ORDERED_PLAN_TYPES.indexOf(b)
    )[0] as PlanType) ?? undefined
  );
}

/**
 * Check if the active plan has the feature at some level.
 */
function checkHasFeature({
  activePlanTypeIndex,
  featureInfo,
}: {
  activePlanTypeIndex: number;
  featureInfo: FeatureInfo;
}) {
  const minPlanType = getMinimumPlanType({featureInfo});
  return !minPlanType || activePlanTypeIndex >= ORDERED_PLAN_TYPES.indexOf(minPlanType);
}

/**
 *
 * Check if the active plan has at least the feature version of the given plan type.
 */
function checkHasFeatureVersion({
  activePlanTypeIndex,
  targetPlanTypeIndex,
}: {
  activePlanTypeIndex: number;
  targetPlanTypeIndex: number;
}) {
  return activePlanTypeIndex >= targetPlanTypeIndex;
}

/**
 * Check if the active plan has a greater feature version than the given plan type.
 */
function checkHasGreaterFeatureVersion({
  activePlanType,
  activePlanTypeIndex,
  targetPlanTypeIndex,
  featureInfo,
}: {
  activePlanType: PlanType;
  activePlanTypeIndex: number;
  featureInfo: FeatureInfo;
  targetPlanTypeIndex: number;
}) {
  return (
    activePlanTypeIndex > targetPlanTypeIndex &&
    activePlanType in featureInfo.displayStringMap
  );
}

function MonitoringAndDataFeatures({
  planOptions,
  activePlan,
}: {
  activePlan: Plan;
  planOptions: Plan[];
}) {
  const activePlanTypeIndex = useMemo(
    () => ORDERED_PLAN_TYPES.indexOf(activePlan.name.toLowerCase() as PlanType),
    [activePlan]
  );
  const featureKeyToInfo: Partial<
    Record<FeatureKey | DataCategory, Omit<FeatureInfo, 'key'>>
  > = {
    alerts: {
      displayStringSuffix: t(' metric alerts'),
      displayStringMap: {},
    },
    dashboards: {
      displayStringSuffix: t(' custom dashboards'),
      displayStringMap: {},
    },
  };
  const orderedKeys: FeatureKey[] = [];

  const previousIncluded: Partial<Record<FeatureKey, number>> = {};
  planOptions.forEach(plan => {
    const planType: PlanType = plan.name.toLowerCase() as PlanType;

    Object.entries(plan.planCategories).forEach(([category, eventBuckets]) => {
      if (!orderedKeys.includes(category as DataCategory)) {
        orderedKeys.push(category as DataCategory);
      }
      const minimumReserved = eventBuckets.find(bucket => bucket.events >= 0)?.events;

      if (
        minimumReserved &&
        minimumReserved !== previousIncluded[category as DataCategory]
      ) {
        const displayUnits =
          minimumReserved > 1 || isByteCategory(category)
            ? getPlanCategoryName({
                plan,
                category: category as DataCategory,
                capitalize: false,
              })
            : getSingularCategoryName({
                plan,
                category: category as DataCategory,
                capitalize: false,
              });
        const formattedReserved = formatReservedWithUnits(
          minimumReserved,
          category as DataCategory,
          {
            isAbbreviated: true,
          }
        );
        const displayString = `${formattedReserved} ${displayUnits}`;
        featureKeyToInfo[category as DataCategory] = {
          displayStringMap: {
            ...featureKeyToInfo[category as DataCategory]?.displayStringMap,
            [planType]: displayString,
          },
        };
      }

      previousIncluded[category as DataCategory] = minimumReserved;
    });

    const {metricDetectorLimit, dashboardLimit} = plan;
    const formattedMetricDetectorLimit =
      metricDetectorLimit === UNLIMITED_RESERVED
        ? t('Unlimited')
        : metricDetectorLimit.toString();
    const formattedDashboardLimit =
      dashboardLimit === UNLIMITED_RESERVED ? t('Unlimited') : dashboardLimit.toString();

    featureKeyToInfo.alerts = {
      ...featureKeyToInfo.alerts,
      displayStringMap: {
        ...featureKeyToInfo.alerts?.displayStringMap,
        [planType]: formattedMetricDetectorLimit,
      },
    };
    featureKeyToInfo.dashboards = {
      ...featureKeyToInfo.dashboards,
      displayStringMap: {
        ...featureKeyToInfo.dashboards?.displayStringMap,
        [planType]: formattedDashboardLimit,
      },
    };
  });
  orderedKeys.push('alerts', 'dashboards');

  const activePlanType = activePlan.name.toLowerCase() as PlanType;

  return (
    <Flex direction="column" gap="md">
      <Flex paddingBottom="md">
        <Heading as="h4" size="xs" variant="muted">
          {t('MONITORING & DATA')}
        </Heading>
      </Flex>
      {orderedKeys.map(key => {
        const info = featureKeyToInfo[key];
        if (!info) {
          return null;
        }

        return (
          <FeatureItem
            key={key}
            isIncluded
            isOnlyOnBusiness={
              Object.keys(info.displayStringMap).length === 1 &&
              Object.keys(info.displayStringMap)[0] === 'business'
            }
          >
            <Flex direction="column" gap="xs">
              {Object.entries(info.displayStringMap).map(([planType, displayString]) => {
                const isActivePlanType = planType === activePlanType;
                const planTypeIndex = ORDERED_PLAN_TYPES.indexOf(planType);
                const hasFeatureVersion = checkHasFeatureVersion({
                  activePlanTypeIndex,
                  targetPlanTypeIndex: planTypeIndex,
                });
                const hasGreaterFeatureVersion = checkHasGreaterFeatureVersion({
                  activePlanType,
                  activePlanTypeIndex,
                  targetPlanTypeIndex: planTypeIndex,
                  featureInfo: {...info, key},
                });
                const isBusinessFeature = planType === 'business';
                const commonProps = {
                  as: 'span' as const,
                  variant:
                    hasGreaterFeatureVersion || !hasFeatureVersion
                      ? ('muted' as const)
                      : ('primary' as const),
                  size: hasFeatureVersion ? ('md' as const) : ('xs' as const),
                };

                return (
                  <Text
                    key={planType + displayString}
                    as="div"
                    strikethrough={hasGreaterFeatureVersion && !isActivePlanType}
                  >
                    <Text {...commonProps}>{info.displayStringPrefix}</Text>
                    <Text
                      {...commonProps}
                      variant={
                        isBusinessFeature
                          ? isActivePlanType
                            ? 'accent'
                            : 'muted'
                          : hasGreaterFeatureVersion
                            ? 'muted'
                            : 'primary'
                      }
                    >
                      {displayString}
                    </Text>
                    <Text {...commonProps}>{info.displayStringSuffix}</Text>
                    {key === 'alerts' && planType === 'business' && (
                      <Text
                        {...commonProps}
                        variant={
                          isBusinessFeature && hasFeatureVersion ? 'accent' : 'muted'
                        }
                      >
                        {t(' + anomaly detection')}
                      </Text>
                    )}
                    {isBusinessFeature && !hasFeatureVersion && (
                      <Text {...commonProps} variant="muted">
                        {t(' on Business only')}
                      </Text>
                    )}
                  </Text>
                );
              })}
            </Flex>
          </FeatureItem>
        );
      })}
    </Flex>
  );
}

function ExpansionPackFeatures({activePlan}: {activePlan: Plan}) {
  const activePlanTypeIndex = useMemo(
    () => ORDERED_PLAN_TYPES.indexOf(activePlan.name.toLowerCase() as PlanType),
    [activePlan]
  );

  return (
    <Flex direction="column" gap="md">
      <Flex paddingBottom="md">
        <Heading as="h4" size="xs" variant="muted">
          {t('EXPANSION PACK')}
        </Heading>
      </Flex>
      {EXPANSION_PACK_FEATURES.map(info => {
        const {key} = info;
        const minPlanType = getMinimumPlanType({featureInfo: info});

        // feature is only available on Business plan
        const isOnlyOnBusiness = minPlanType === 'business';

        // active plan has the feature at some level
        const hasFeature = checkHasFeature({activePlanTypeIndex, featureInfo: info});

        return (
          <FeatureItem
            key={key}
            isOnlyOnBusiness={isOnlyOnBusiness}
            isIncluded={hasFeature}
          >
            <Flex direction="column" gap="xs">
              {Object.entries(info.displayStringMap).map(([planType, displayString]) => {
                const hasFeatureVersion = checkHasFeatureVersion({
                  activePlanTypeIndex,
                  targetPlanTypeIndex: ORDERED_PLAN_TYPES.indexOf(planType),
                });

                const isBusinessFeature = planType === 'business';
                const commonProps = {
                  as: 'span' as const,
                  variant: hasFeatureVersion ? ('primary' as const) : ('muted' as const),
                  size:
                    isBusinessFeature && !hasFeatureVersion && !isOnlyOnBusiness
                      ? ('sm' as const)
                      : ('md' as const),
                };

                return (
                  <Text key={planType + displayString} as="div">
                    <Text
                      {...commonProps}
                      variant={
                        hasFeatureVersion
                          ? isBusinessFeature && !isOnlyOnBusiness
                            ? 'accent'
                            : 'primary'
                          : 'muted'
                      }
                    >
                      {displayString}
                    </Text>
                    <Text {...commonProps}>{info.displayStringSuffix}</Text>
                    {isBusinessFeature && !isOnlyOnBusiness && !hasFeatureVersion && (
                      <Text {...commonProps} variant="muted">
                        {t(' on Business only')}
                      </Text>
                    )}
                  </Text>
                );
              })}
            </Flex>
          </FeatureItem>
        );
      })}
    </Flex>
  );
}

function FeatureItem({
  children,
  isOnlyOnBusiness,
  isIncluded,
}: {
  children: React.ReactNode;
  isIncluded: boolean;
  isOnlyOnBusiness: boolean;
}) {
  return (
    <Flex align="start" gap="md">
      <Container padding="0">
        {isIncluded ? (
          isOnlyOnBusiness ? (
            <IconAdd size="sm" color="activeText" />
          ) : (
            <IconCheckmark size="sm" color="success" />
          )
        ) : (
          <IconClose size="sm" color="disabled" />
        )}
      </Container>
      {children}
    </Flex>
  );
}

function PlanFeatures({
  planOptions,
  activePlan,
}: {
  activePlan: Plan;
  planOptions: Plan[];
}) {
  const currentTier = getAmPlanTier(activePlan.id);
  const perPlanPriceDiffs: Record<
    Plan['id'],
    Partial<Record<DataCategory, number>> & {plan: Plan}
  > = {};
  planOptions.forEach((planOption, index) => {
    const priorPlan = index > 0 ? planOptions[index - 1] : null;
    if (priorPlan && priorPlan?.basePrice > 0) {
      perPlanPriceDiffs[planOption.id] = {
        plan: planOption,
        ...Object.entries(planOption.planCategories ?? {}).reduce(
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
        ),
      };
    }
  });

  return (
    <Flex direction="column">
      <Flex
        background="secondary"
        padding="xl"
        radius="lg"
        border="primary"
        gap="xl"
        direction="column"
      >
        <Grid columns={{xs: '1fr', sm: `repeat(2, 1fr)`}} gap="xl">
          <MonitoringAndDataFeatures planOptions={planOptions} activePlan={activePlan} />
          <ExpansionPackFeatures activePlan={activePlan} />
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
      {Object.entries(perPlanPriceDiffs).map(([planId, info]) => {
        const {plan, ...priceDiffs} = info;
        const planName = plan.name;

        return (
          <Container padding="xl" key={planId}>
            <Tooltip
              title={tct('Starting at [priceDiffs] more on [planName]', {
                priceDiffs: oxfordizeArray(
                  Object.entries(priceDiffs).map(([category, diff]) => {
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
              <Flex gap="sm">
                <IconWarning size="sm" color="disabled" />
                <Text size="sm" variant="muted">
                  {tct('Excess usage for [categories] costs more on [planName]', {
                    categories: listDisplayNames({
                      plan,
                      categories: Object.keys(priceDiffs) as DataCategory[],
                      shouldTitleCase: true,
                    }),
                    planName,
                  })}
                </Text>
              </Flex>
            </Tooltip>
          </Container>
        );
      })}
    </Flex>
  );
}

export default PlanFeatures;
