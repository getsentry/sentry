import styled from '@emotion/styled';

import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCheckmark, IconClose, IconWarning} from 'sentry/icons';
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
      t('5K errors'),
      t('5GB of logs'),
      t('5M spans'),
      t('50 replays'),
      t('10 custom dashboards'),
      t('1 cron monitor'),
      t('1 uptime monitor'),
      t('1GB of attachments'),
      t('20 metric alerts'),
    ],
  },
  {
    plan: 'team',
    features: [
      t('Unlimited users'),
      t('50K errors'),
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

// TODO(isabella): Remove this once we've actually surfaced the free plan
const MODIFIED_FEATURES: Array<{features: string[]; plan: string}> = [
  {
    plan: 'developer',
    features: [
      t('Unlimited users'),
      t('50K errors'),
      t('5GB of logs'),
      t('5M spans'),
      t('50 replays'),
      t('1 cron monitor'),
      t('1 uptime monitor'),
      t('1GB of attachments'),
      t('20 metric alerts'),
    ],
  },
  {
    plan: 'team',
    features: [
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
  // XXX(isabella): this is a hacky way to show the free features
  // without free plan being surfaced in the UI
  // (will be removed when free is surfaced)
  const planOptionsWithFree =
    planOptions.length >= 3
      ? planOptions
      : [
          {
            ...planOptions[0],
            name: 'Developer',
          } as Plan,
          ...planOptions,
        ];

  planOptionsWithFree.forEach((planOption, index) => {
    const planName = planOption.name.toLowerCase();
    const priorPlan = index > 0 ? planOptionsWithFree[index - 1] : null;
    const featureList = (planOptions.length >= 3 ? FEATURES : MODIFIED_FEATURES)
      .filter(({plan}) => planName.includes(plan))
      .flatMap(({features}) => features);
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
      <Grid
        columns={{xs: '1fr', sm: `repeat(${planOptionsWithFree.length}, 1fr)`}}
        gap="md xl"
      >
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
              gap="md"
            >
              {features.map(feature => (
                <FeatureItem key={feature} feature={feature} isIncluded={isIncluded} />
              ))}
              {Object.keys(perUnitPriceDiffs).length > 0 && (
                <EventPriceWarning isIncluded={isIncluded} align="center" gap="sm">
                  <IconWarning size="sm" color="yellow300" />
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
                    {/* TODO(checkout v3): verify tooltip copy */}
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
