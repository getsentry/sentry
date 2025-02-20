import {Fragment} from 'react';
import styled from '@emotion/styled';
import groupBy from 'lodash/groupBy';
import partition from 'lodash/partition';

import {IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Hooks} from 'sentry/types/hooks';
import type {IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {getIntegrationType} from 'sentry/utils/integrationUtil';

import UpsellButton from 'getsentry/components/upsellButton';
import withSubscription from 'getsentry/components/withSubscription';
import {useBillingConfig} from 'getsentry/hooks/useBillingConfig';
import type {BillingConfig, Plan, Subscription} from 'getsentry/types';
import {displayPlanName} from 'getsentry/utils/billing';

type IntegrationFeature = {
  description: React.ReactNode;
  featureGate: string;
};

type GatedFeatureGroup = {
  features: IntegrationFeature[];
  hasFeatures: boolean;
  plan?: Plan;
};

type MapFeatureGroupsOpts = {
  billingConfig: BillingConfig;
  features: IntegrationFeature[];
  organization: Organization;
  subscription: Subscription;
};

/**
 * Given a users subscription, billing config, and organization, determine from
 * a set of features three things:
 *
 * - What features are free ungated features.
 *
 * - Group together features that *are* gated by plan type, and indicate if the
 *   current plan type supports that set of features
 *
 * - Does the user current plan support *any* of the features, or are they
 *   required to upgrade to receive any features.
 */
function mapFeatureGroups({
  features,
  organization,
  subscription,
  billingConfig,
}: MapFeatureGroupsOpts) {
  if (billingConfig === null || subscription === null) {
    return {
      disabled: false,
      disabledReason: null,
      ungatedFeatures: [],
      gatedFeatureGroups: [],
    };
  }

  // Group integration by if their features are part of a paid subscription.
  const [ungatedFeatures, premiumFeatures] = partition(
    features,
    (feature: IntegrationFeature) =>
      billingConfig.featureList[feature.featureGate] === undefined
  );

  // TODO: use sortPlansForUpgrade here
  // Filter plans down to just user selectable plans types of the orgs current
  // contract interval. Sorted by price as features will become progressively
  // more available.
  let plans = billingConfig.planList
    .sort((a, b) => a.price - b.price)
    .filter(p => p.userSelectable && p.billingInterval === subscription.billingInterval);

  // If we're dealing with plans that are *not part of a tier* Then we can
  // assume special case that there is only one plan.
  if (billingConfig.id === null && plans.length === 0) {
    plans = billingConfig.planList;
  }

  // Group premium features by the plans they belong to
  const groupedPlanFeatures = groupBy(
    premiumFeatures,
    feature => plans.find(p => p.features.includes(feature.featureGate))?.id
  );

  // Transform our grouped plan features into a list of feature groups
  // including the plan. For each feature group it is determined if all
  // features also have associated organization feature flags, indicating that
  // the features are enabled.
  const gatedFeatureGroups = plans
    .filter(plan => groupedPlanFeatures[plan.id] !== undefined)
    .map<GatedFeatureGroup>(plan => ({
      plan,
      features: groupedPlanFeatures[plan.id]!,
      hasFeatures:
        groupedPlanFeatures[plan.id]!.map(f => f.featureGate)
          .map(f => organization.features.includes(f))
          .filter(v => v !== true).length === 0,
    }));

  // Are any features available for the current users plan?
  const disabled =
    ungatedFeatures.length === 0 &&
    gatedFeatureGroups.filter(group => group.hasFeatures).length === 0;

  // Checks if 'disabled' and if there are any gatedFeatureGroups with plans,
  // then takes the cheapest tiered plan and generates the first error message.
  // If gatedFeatureGroups do not exist and is disabled, then give generic error message.
  // There are some deprecated plugins that require this logic that some customers may see.
  const disabledReason =
    disabled && gatedFeatureGroups.length && gatedFeatureGroups[0]!.plan
      ? tct('Requires [planName] Plan or above', {
          planName: displayPlanName(gatedFeatureGroups[0]!.plan),
        })
      : disabled
        ? t('Integration unavailable on your billing plan.')
        : null;

  return {ungatedFeatures, gatedFeatureGroups, disabled, disabledReason};
}

type RenderProps = {
  /**
   * Boolean false if the integration may be installed on the current users
   * plan, or a string describing why it cannot be installed.
   */
  disabled: boolean;
  /**
   * The text (translated) reason the integration cannot be installed.
   */
  disabledReason: React.ReactNode;
  /**
   * Features grouped by what plan they belong to.
   */
  gatedFeatureGroups: GatedFeatureGroup[];
  /**
   * A list of features that are available for free.
   */
  ungatedFeatures: IntegrationFeature[];
};

type IntegrationFeaturesProps = {
  children: (props: RenderProps) => React.ReactElement;
  features: IntegrationFeature[];
  organization: Organization;
  subscription: Subscription;
};

function IntegrationFeaturesBase({
  features,
  organization,
  subscription,
  children,
}: IntegrationFeaturesProps) {
  const {data: billingConfig} = useBillingConfig({organization, subscription});

  if (!billingConfig) {
    return null;
  }

  const opts = mapFeatureGroups({
    features,
    organization,
    subscription,
    billingConfig,
  });

  return children(opts);
}

const IntegrationFeatures = withSubscription(IntegrationFeaturesBase);

type FeatureListProps = Omit<IntegrationFeaturesProps, 'children'> & {
  provider: Pick<IntegrationProvider, 'key'>;
};

function FeatureListBase(props: FeatureListProps) {
  const {provider, subscription, organization} = props;
  return (
    <IntegrationFeatures {...props}>
      {({ungatedFeatures, gatedFeatureGroups}) => (
        <Fragment>
          <IntegrationFeatureGroup
            message={tct('For [plans:All billing plans]', {plans: <strong />})}
            features={ungatedFeatures}
            hasFeatures
          />
          {gatedFeatureGroups.map(({plan, features, hasFeatures}) => {
            const planText = tct('[planName] billing plans', {
              planName: displayPlanName(plan),
            });

            const action = (
              <UpsellButton
                source="integration-features"
                size="xs"
                subscription={subscription}
                organization={organization}
                priority="primary"
                extraAnalyticsParams={{
                  integration: provider.key,
                  integration_type: getIntegrationType(provider as IntegrationProvider),
                  integration_tab: 'overview',
                  plan: plan?.name,
                }}
              />
            );

            const message = (
              <Fragment>
                {tct('For [plan] and above', {plan: <strong>{planText}</strong>})}
              </Fragment>
            );

            return (
              <IntegrationFeatureGroup
                key={plan?.id}
                message={message}
                features={features}
                hasFeatures={hasFeatures}
                action={!hasFeatures && action}
              />
            );
          })}
        </Fragment>
      )}
    </IntegrationFeatures>
  );
}

const FeatureList = withSubscription(FeatureListBase);

const HasFeatureIndicator = styled((p: any) => (
  <div {...p}>
    Enabled
    <IconCheckmark isCircled />
  </div>
))`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.green300};
  font-weight: bold;
  text-transform: uppercase;
  font-size: 0.8em;
  margin-right: 4px;
`;

type GroupProps = {
  features: IntegrationFeature[];
  hasFeatures: boolean;
  message: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

const IntegrationFeatureGroup = styled((p: GroupProps) => {
  if (p.features.length === 0) {
    return null;
  }

  return (
    <div className={p.className}>
      <FeatureGroupHeading>
        <div>{p.message}</div>
        {p.action && p.action}
        {p.hasFeatures && <HasFeatureIndicator />}
      </FeatureGroupHeading>
      <GroupFeatureList features={p.features} />
    </div>
  );
})`
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid ${p => p.theme.gray200};
  margin-bottom: ${space(2)};
`;

const FeatureGroupHeading = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${p => p.theme.gray200};
  background: ${p => p.theme.backgroundSecondary};
  font-size: 0.9em;
  padding: 8px 8px 8px 12px;
`;

type GroupListProps = Pick<GroupProps, 'features' | 'className'>;

const GroupFeatureList = styled(({features, className}: GroupListProps) => (
  <ul className={className}>
    {features.map((feature, i) => (
      <FeatureDescription key={i}>{feature.description}</FeatureDescription>
    ))}
  </ul>
))`
  padding: 0;
  margin: 0;
  list-style: none;
  background-color: ${p => p.theme.background};
`;

const FeatureDescription = styled('li')`
  padding: 8px 12px;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.gray200};
  }
`;

/**
 * This hook provides integration feature components used to determine what
 * features an organization currently has access too.
 *
 * All components exported through this hook require the organization and
 * integration features list to be passed
 *
 * Provides two components:
 *
 * - IntegrationFeatures
 *   This is a render-prop style component that given a set of integration
 *   features will call children as a render-prop. See the proptypes
 *   descriptions above.
 *
 * - FeatureList
 *   Renders a list of integration features grouped by plan.
 */
const hookIntegrationFeatures = () => ({
  IntegrationFeatures,
  FeatureList,
});

export default hookIntegrationFeatures as Hooks['integrations:feature-gates'];
