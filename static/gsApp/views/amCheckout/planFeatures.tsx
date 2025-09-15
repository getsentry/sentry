import styled from '@emotion/styled';

import {Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';

import type {Plan} from 'getsentry/types';
import {getSingularCategoryName, listDisplayNames} from 'getsentry/utils/dataCategory';
import {displayUnitPrice} from 'getsentry/views/amCheckout/utils';

interface PlanFeatureInfo {
  features: string[];
  perUnitPriceDiffs: Partial<Record<DataCategory, number>>;
  plan: Plan;
}

// TODO(checkout v3): Move features list to backend
const FEATURES: Array<{features: string[]; plan: string}> = [
  {
    plan: 'developer',
    features: [
      t('1 user'),
      t('5k Errors'),
      t('5GB of Logs'),
      t('5M Spans'),
      t('50 Replays'),
      t('10 custom dashboards'),
      t('1 Cron Monitor'),
      t('1 Uptime Monitor'),
      t('1GB of Attachments'),
      t('20 metric alerts'),
    ],
  },
  {
    plan: 'team',
    features: [
      t('Unlimited users'),
      t('50K Errors'),
      t('Access to UI and Continuous Profiling'),
      t('Can add event volume to subscription'),
      t('Third-party integrations'),
      t('20 custom dashboards'),
      t('Seer: AI debugging agent (subscription required)'),
      t('Single Sign-On'),
      t('Up to 90 day retention'),
    ],
  },
  {
    plan: 'business',
    features: [
      t('Insights (90-day lookback)'),
      t('Unlimited custom dashboards'),
      t('Unlimited metric alerts'),
      t('Advanced quota management'),
      t('Code Owners support'),
      t('SAML + SCIM support'),
      t('BAA'),
    ],
  },
];

function FeatureItem({feature, isIncluded}: {feature: string; isIncluded: boolean}) {
  return (
    <Flex gap="sm">
      {isIncluded ? (
        <IconCheckmark size="md" color="success" />
      ) : (
        <IconClose size="md" color="error" />
      )}
      <Text variant={isIncluded ? 'primary' : 'muted'}>{feature}</Text>
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
  const planToFeatures: PlanFeatureInfo[] = [];
  let activePlanIndex = 0;
  planOptions.forEach((planOption, index) => {
    const planName = planOption.name.toLowerCase();
    const priorPlan = index > 0 ? planOptions[index - 1] : null;
    const featureList = FEATURES.filter(({plan}) => planName.includes(plan)).flatMap(
      ({features}) => features
    );
    const perUnitPriceDiffs =
      !priorPlan || priorPlan?.basePrice === 0
        ? {}
        : Object.entries(planOption.planCategories).reduce(
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
      padding="2xl"
      radius="lg"
      border="primary"
      gap="sm"
      direction="column"
    >
      <Heading as="h3" size="xl">
        {t("What's included")}
      </Heading>
      <Grid columns={{xs: '1fr', sm: `repeat(${planOptions.length}, 1fr)`}} gap="sm">
        {planToFeatures.map(({plan, features, perUnitPriceDiffs}, index) => {
          const planName = plan.name;
          const lowerCasePlanName = planName.toLowerCase();
          const isIncluded = activePlanIndex >= index;
          const dataTestId = `${lowerCasePlanName}-features-${isIncluded ? 'included' : 'excluded'}`;
          return (
            <Flex
              data-test-id={dataTestId}
              key={lowerCasePlanName}
              direction="column"
              gap="sm"
            >
              {features.map(feature => (
                <FeatureItem key={feature} feature={feature} isIncluded={isIncluded} />
              ))}
              {Object.keys(perUnitPriceDiffs).length > 0 && (
                <EventPriceWarning align="center" gap="sm">
                  <Tooltip
                    title={tct('Starting at [priceDiffs].', {
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
                    })}
                  >
                    {/* TODO(checkout v3): verify tooltip copy */}
                    <Text as="span" size="sm" variant="muted">
                      {tct('*Excess usage for [categories] costs more on [planName]', {
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
    </Flex>
  );
}

export default PlanFeatures;

const EventPriceWarning = styled(Flex)`
  > span {
    text-decoration: underline dotted;
    text-decoration-color: ${p => p.theme.subText};
  }
`;
