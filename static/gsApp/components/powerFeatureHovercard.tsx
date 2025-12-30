import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Hovercard} from 'sentry/components/hovercard';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import PlanFeature from 'getsentry/components/features/planFeature';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import {displayPlanName} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

interface PowerFeatureHovercardProps {
  /**
   * The set of features that are required for this feature. Used to
   * determine which plan is required for the feature.
   *
   * NOTE: If the user has all features the hovercard will NOT be hidden. It
   * is up to the parent component to decide whether this should be rendered.
   */
  features: Organization['features'];
  organization: Organization;

  subscription: Subscription;
  children?: React.ReactNode;
  containerClassName?: string;
  containerDisplayMode?: React.ComponentProps<
    typeof StyledHovercard
  >['containerDisplayMode'];

  /**
   * The key passed to analytics when clicking learn more, as well as the key
   * used as the source when opening the landing modal.
   */
  id?: string;

  /**
   * When enabled the hovercard will indicate that *some* features will
   * require an upgraded plan.
   */
  partial?: boolean;

  /**
   * Replaces the default learn more button with a more subtle link text that
   * opens the upsell modal.
   */
  useLearnMoreLink?: boolean;
}

function PowerFeatureHovercard({
  id,
  containerClassName,
  containerDisplayMode,
  organization,
  subscription,
  partial,
  features,
  children,
}: PowerFeatureHovercardProps) {
  const recordAnalytics = () => {
    trackGetsentryAnalytics('power_icon.clicked', {
      organization,
      subscription,
      source: id,
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    recordAnalytics();
    openUpsellModal({
      organization,
      source: id ?? '',
    });
  };

  const hoverBody = (
    <PlanFeature
      features={features}
      organization={organization}
      subscription={subscription}
    >
      {({plan, tierChange}) => {
        let planName = displayPlanName(plan);

        if (tierChange === PlanTier.AM1) {
          planName = `Performance ${planName}`;
        }

        return (
          <LearnMoreTextBody data-test-id="power-hovercard">
            <Flex direction="column" gap="md">
              <div>
                {partial
                  ? t('Better With %s Plan', planName)
                  : t('Requires %s Plan', planName)}
              </div>
              <Button
                priority="primary"
                onClick={handleClick}
                data-test-id="power-learn-more"
                size="xs"
                icon={<IconLightning size="xs" />}
              >
                {t('Learn More')}
              </Button>
            </Flex>
          </LearnMoreTextBody>
        );
      }}
    </PlanFeature>
  );

  return (
    <StyledHovercard
      containerClassName={containerClassName}
      containerDisplayMode={containerDisplayMode}
      bodyClassName="power-icon"
      body={hoverBody}
      position="right"
      delay={200}
    >
      {children}
    </StyledHovercard>
  );
}

const LearnMoreTextBody = styled('div')`
  padding: ${space(1)};
`;

const StyledHovercard = styled(Hovercard)`
  width: auto;
  border-radius: ${p => p.theme.radius.md};
  .power-icon {
    padding: 0;
    align-items: center;
  }
`;

export default withOrganization(
  withSubscription(PowerFeatureHovercard, {noLoader: true})
);
