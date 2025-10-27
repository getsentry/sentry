import type React from 'react';
import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
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
    displayStringPrefix: t('SSO w/ '),
    displayStringMap: {
      team: t('GitHub and Google'),
      business: t('SAML + SCIM support'),
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
      business: t('Insights (90 day lookback)'),
    },
    excludedTiers: [PlanTier.AM1],
  },
  {
    key: 'codeowners',
    displayStringMap: {
      business: t('Code Owners support'),
    },
  },
  {
    key: 'baa',
    displayStringMap: {
      business: t('BAA'),
    },
  },
];

function MonitoringAndDataFeatures({
  planOptions,
  activePlan,
}: {
  activePlan: Plan;
  planOptions: Plan[];
}) {
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
    <Flex direction="column" gap="lg">
      <Heading as="h4" size="xs" variant="muted">
        {t('MONITORING & DATA')}
      </Heading>
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
            <Flex direction="column" gap="sm">
              {Object.entries(info.displayStringMap).map(([planType, displayString]) => {
                const isActivePlanType = planType === activePlanType;
                const hasFeature =
                  isActivePlanType || !(activePlanType in info.displayStringMap);
                const isBusinessFeature = planType === 'business';
                const commonProps = {
                  as: 'span' as const,
                  variant: hasFeature ? ('primary' as const) : ('muted' as const),
                  size:
                    isBusinessFeature && !hasFeature ? ('xs' as const) : ('md' as const),
                };

                return (
                  <Text
                    key={planType + displayString}
                    as="div"
                    strikethrough={!hasFeature && !isBusinessFeature}
                  >
                    <Text {...commonProps}>{info.displayStringPrefix}</Text>
                    <Text
                      {...commonProps}
                      variant={
                        hasFeature
                          ? isBusinessFeature && isActivePlanType
                            ? 'accent'
                            : 'primary'
                          : 'muted'
                      }
                    >
                      {displayString}
                    </Text>
                    <Text {...commonProps}>{info.displayStringSuffix}</Text>
                    {key === 'alerts' && planType === 'business' && (
                      <Text
                        {...commonProps}
                        variant={isBusinessFeature && hasFeature ? 'accent' : 'muted'}
                      >
                        {t(' + anomaly detection')}
                      </Text>
                    )}
                    {isBusinessFeature && !hasFeature && (
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
  const activePlanType = activePlan.name.toLowerCase() as PlanType;
  const activePlanTypeIndex = ORDERED_PLAN_TYPES.indexOf(activePlanType);
  return (
    <Flex direction="column" gap="lg">
      <Heading as="h4" size="xs" variant="muted">
        {t('EXPANSION PACK')}
      </Heading>
      {EXPANSION_PACK_FEATURES.map(info => {
        const {key} = info;
        const minPlanType = Object.keys(info.displayStringMap).sort(
          (a, b) => ORDERED_PLAN_TYPES.indexOf(a) - ORDERED_PLAN_TYPES.indexOf(b)
        )[0];

        // feature is only available on Business plan
        const isOnlyOnBusiness = minPlanType === 'business';

        // active plan has the feature at some level
        const hasFeature =
          !minPlanType || activePlanTypeIndex >= ORDERED_PLAN_TYPES.indexOf(minPlanType);

        return (
          <FeatureItem
            key={key}
            isOnlyOnBusiness={isOnlyOnBusiness}
            isIncluded={hasFeature}
          >
            <Flex direction="column" gap="sm">
              {Object.entries(info.displayStringMap).map(([planType, displayString]) => {
                const planTypeIndex = ORDERED_PLAN_TYPES.indexOf(planType);

                // active plan has this specific version of the feature
                const hasPlanTypeFeature = activePlanTypeIndex >= planTypeIndex;

                const isBusinessFeature = planType === 'business';
                const commonProps = {
                  as: 'span' as const,
                  variant: hasPlanTypeFeature ? ('primary' as const) : ('muted' as const),
                  size:
                    (isBusinessFeature && !hasPlanTypeFeature) ||
                    (isOnlyOnBusiness && !hasFeature)
                      ? ('xs' as const)
                      : ('md' as const),
                };

                return (
                  <Text key={planType + displayString} as="div">
                    <Text {...commonProps}>{info.displayStringPrefix}</Text>
                    <Text
                      {...commonProps}
                      variant={
                        hasPlanTypeFeature
                          ? isBusinessFeature && !isOnlyOnBusiness
                            ? 'accent'
                            : 'primary'
                          : 'muted'
                      }
                    >
                      {displayString}
                    </Text>
                    <Text {...commonProps}>{info.displayStringSuffix}</Text>
                    {isBusinessFeature && !isOnlyOnBusiness && !hasPlanTypeFeature && (
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
    <FeatureItemContainer align="start" gap="md">
      <Container padding="0">
        {isIncluded ? (
          isOnlyOnBusiness ? (
            <IconAdd size="sm" color="active" />
          ) : (
            <IconCheckmark size="sm" color="success" />
          )
        ) : (
          <IconClose size="xs" color="disabled" />
        )}
      </Container>
      {children}
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
  const currentTier = getAmPlanTier(activePlan.id);
  const perPlanPriceDiffs = useMemo(() => {
    const priceDiffs: Record<
      Plan['id'],
      Partial<Record<DataCategory, number>> & {plan: Plan}
    > = {};
    planOptions.forEach((planOption, index) => {
      const priorPlan = index > 0 ? planOptions[index - 1] : null;
      if (priorPlan && priorPlan?.basePrice > 0) {
        priceDiffs[planOption.id] = {
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
    return priceDiffs;
  }, [planOptions]);

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

const FeatureItemContainer = styled(Flex)`
  color: ${p => p.theme.textColor};
`;
