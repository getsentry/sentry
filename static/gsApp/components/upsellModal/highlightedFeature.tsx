import styled from '@emotion/styled';

import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import PlanFeature from 'getsentry/components/features/planFeature';
import type {Subscription} from 'getsentry/types';
import {displayPlanName, hasPerformance} from 'getsentry/utils/billing';

import type {Feature} from './types';

type Props = {
  feature: Feature;
  organization: Organization;
  subscription: Subscription;
};

const IMAGE_SIZE = {height: 'auto', width: '540px'};

function HighlightedFeature({feature, organization, subscription}: Props) {
  return (
    <Description data-test-id="highlighted-feature">
      <div>{feature.desc}</div>
      {feature.image && <FeatureImg src={feature.image} {...IMAGE_SIZE} />}
      <PlanContext>
        {hasPerformance(subscription.planDetails)
          ? tct("You'll need the [plan] or up to enable this feature.", {
              plan: (
                <PlanFeature
                  {...{organization, subscription}}
                  features={feature.planFeatures}
                >
                  {({plan}) => <strong>{t('%s Plan', displayPlanName(plan))}</strong>}
                </PlanFeature>
              ),
            })
          : tct(
              "You'll need to migrate to a new plan with [strong:Transactions] to enable this feature.",
              {
                strong: <strong />,
              }
            )}
        {!subscription.isTrial &&
          tct(" You're currently on the [current] plan.", {
            current: subscription.planDetails.name,
          })}
      </PlanContext>
    </Description>
  );
}

const Description = styled('div')`
  display: flex;
  flex-direction: column;
`;

const FeatureImg = styled('img')`
  margin: ${space(2)} 0;
`;

const PlanContext = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  line-height: 1.5;
`;

export default HighlightedFeature;
