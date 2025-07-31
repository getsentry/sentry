import {Fragment} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {IconBusiness} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import PowerFeatureHovercard from 'getsentry/components/powerFeatureHovercard';
import withSubscription from 'getsentry/components/withSubscription';
import {useBillingConfig} from 'getsentry/hooks/useBillingConfig';
import type {Subscription} from 'getsentry/types';

interface ChildRenderProps {
  Wrapper: React.FunctionComponent<{children: React.ReactElement}>;
  additionalContent: React.ReactElement | null;
  disabled: boolean;
}

interface Props {
  children: (opts: ChildRenderProps) => React.ReactElement;
  id: string;
  organization: Organization;
  subscription: Subscription;
}

/** @internal exported for tests only */
export function SidebarNavigationItem({id, organization, subscription, children}: Props) {
  const {data: billingConfig} = useBillingConfig({organization, subscription});

  const subscriptionPlan = subscription.planDetails;
  const subscriptionPlanFeatures = subscriptionPlan?.features ?? [];

  const trialPlan = subscription.trialPlan
    ? billingConfig?.planList?.find(plan => plan.id === subscription.trialPlan)
    : undefined;
  const trialPlanFeatures = trialPlan?.features ?? [];

  const planFeatures = [...new Set([...subscriptionPlanFeatures, ...trialPlanFeatures])];

  const rule = NavigationItemAccessRule.forId(id, organization, planFeatures);

  return children(rule.props);
}

interface CheckableForAccess {
  get props(): ChildRenderProps;
}

class NavigationItemAccessRule implements CheckableForAccess {
  id: string;
  organization: Organization;
  planFeatures: string[];

  constructor(id: string, organization: Organization, planFeatures: string[]) {
    this.id = id;
    this.organization = organization;
    this.planFeatures = planFeatures;
  }

  get props(): ChildRenderProps {
    return {
      disabled: false,
      additionalContent: null,
      Wrapper: Fragment,
    };
  }

  static forId(
    id: string,
    organization: Organization,
    planFeatures: string[]
  ): CheckableForAccess {
    let cls: any;

    if (id === 'sidebar-accordion-insights-item') {
      cls = InsightsAccordionAccessRule;
    } else if (Object.keys(INSIGHTS_LINK_ID_FEATURE_REQUIREMENTS).includes(id)) {
      cls = InsightsItemAccessRule;
    } else {
      cls = NavigationItemAccessRule;
    }

    return new cls(id, organization, planFeatures);
  }
}

export class InsightsItemAccessRule extends NavigationItemAccessRule {
  get doesOrganizationHaveAnyInsightsAccess() {
    return (
      this.organization?.features?.includes('insights-initial-modules') ||
      this.organization?.features?.includes('insights-addon-modules')
    );
  }

  get hasRequiredFeatures(): boolean {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const requiredFeatures = INSIGHTS_LINK_ID_FEATURE_REQUIREMENTS[this.id] ?? [];

    const enabledFeatures = [...this.planFeatures, ...this.organization.features];

    return requiredFeatures.every((feature: any) => enabledFeatures.includes(feature));
  }

  get props() {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const requiredFeatures = INSIGHTS_LINK_ID_FEATURE_REQUIREMENTS[this.id] ?? [];
    const hasRequiredFeatures = this.hasRequiredFeatures;

    // Show the Turbo link if the organization doesn't have access to that link, but hide it if they don't have access to _any_ Insight modules, since in that case there'd be a Turbo icon next to each item
    const hasTurboIcon =
      !hasRequiredFeatures && this.doesOrganizationHaveAnyInsightsAccess;

    return {
      disabled: !hasRequiredFeatures,
      additionalContent: hasTurboIcon ? <CenteredIcon data-test-id="power-icon" /> : null,
      Wrapper: hasRequiredFeatures
        ? Fragment
        : makeUpsellWrapper(this.id, requiredFeatures ?? []),
    };
  }
}

class InsightsAccordionAccessRule extends InsightsItemAccessRule {
  get props() {
    // If the organization has access to _some_ modules, leave the Insights link alone. If it doesn't have any access to Insights modules, show an upsell around the "Insights" link.
    return this.doesOrganizationHaveAnyInsightsAccess
      ? {
          disabled: false,
          additionalContent: null,
          Wrapper: Fragment,
        }
      : {
          disabled: true,
          additionalContent: <CenteredIcon data-test-id="power-icon" />,
          Wrapper: makeUpsellWrapper(this.id, ['insights-initial-modules']),
        };
  }
}

const CenteredIcon = styled(IconBusiness)`
  display: inline-flex;
  flex-shrink: 0;
  margin-left: ${space(1)};
`;

function makeUpsellWrapper(
  id: string,
  requiredFeatures: string[]
): React.FunctionComponent<{children: React.ReactElement}> {
  // @ts-expect-error TS(7031): Binding element 'upsellWrapperChildren' implicitly... Remove this comment to see the full error message
  function UpsellWrapper({children: upsellWrapperChildren}) {
    return (
      <ClassNames>
        {({css}) => (
          <PowerFeatureHovercard
            id={id}
            partial={false}
            features={requiredFeatures}
            containerDisplayMode="inline-block"
            containerClassName={css`
              width: 100%;
            `}
          >
            {upsellWrapperChildren}
          </PowerFeatureHovercard>
        )}
      </ClassNames>
    );
  }

  return UpsellWrapper;
}

// Each key is an `id` prop of `SidebarItem` components. Each value is a list of plan feature strings that id needs
const INSIGHTS_LINK_ID_FEATURE_REQUIREMENTS = {
  'performance-database': ['insights-initial-modules'],
  'performance-http': ['insights-initial-modules'],
  'performance-webvitals': ['insights-initial-modules'],
  'performance-mobile-screens': ['insights-initial-modules'],
  'performance-mobile-app-startup': ['insights-initial-modules'],
  'performance-browser-resources': ['insights-initial-modules'],
  'performance-cache': ['insights-addon-modules'],
  'performance-queues': ['insights-addon-modules'],
  'performance-mobile-ui': ['insights-addon-modules'],
  'llm-monitoring': ['insights-addon-modules'],
  'performance-screen-rendering': ['insights-addon-modules'],
};

export type InsightSidebarId = keyof typeof INSIGHTS_LINK_ID_FEATURE_REQUIREMENTS;

export default withOrganization(
  withSubscription(SidebarNavigationItem, {noLoader: true})
);
