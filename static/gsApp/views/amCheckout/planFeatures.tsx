import {Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {Plan} from 'getsentry/types';

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
  const planName = activePlan.name.toLowerCase();
  const featureList = FEATURES.filter(({plan}) =>
    planOptions.some(p => p.name.toLowerCase().includes(plan))
  );
  const featureListIndex = featureList.findIndex(feature =>
    planName.includes(feature.plan)
  );
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
      <Grid columns={`repeat(${planOptions.length}, 1fr)`} gap="sm">
        {featureList.map(({plan, features}, index) => {
          const isIncluded = featureListIndex >= index;
          const dataTestId = `${plan}-features-${isIncluded ? 'included' : 'excluded'}`;
          return (
            <Flex data-test-id={dataTestId} key={plan} direction="column" gap="sm">
              {features.map(feature => (
                <FeatureItem key={feature} feature={feature} isIncluded={isIncluded} />
              ))}
            </Flex>
          );
        })}
      </Grid>
    </Flex>
  );
}

export default PlanFeatures;
