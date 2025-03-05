import {Component} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Hovercard} from 'sentry/components/hovercard';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import PlanFeature from 'getsentry/components/features/planFeature';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import {displayPlanName} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
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

  upsellDefaultSelection?: string;
};

class PowerFeatureHovercard extends Component<Props> {
  recordAnalytics() {
    const {id, organization, subscription} = this.props;
    trackGetsentryAnalytics('power_icon.clicked', {
      organization,
      subscription,
      source: id,
    });
  }

  handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const {organization, id} = this.props;

    this.recordAnalytics();
    openUpsellModal({
      organization,
      source: id ?? '',
      defaultSelection: this.props.upsellDefaultSelection,
    });
  };

  render() {
    const {
      containerClassName,
      containerDisplayMode,
      organization,
      subscription,
      partial,
      features,
      children,
    } = this.props;

    const hoverBody = (
      <PlanFeature features={features} {...{organization, subscription}}>
        {({plan, tierChange}) => {
          let planName = displayPlanName(plan);

          if (tierChange === PlanTier.AM1) {
            planName = `Performance ${planName}`;
          }

          return (
            <HovercardBody data-test-id="power-hovercard">
              <Text>
                {partial
                  ? t('Better With %s Plan', planName)
                  : t('Requires %s Plan', planName)}
              </Text>
              <UpsellModalButton
                priority="primary"
                size="sm"
                onClick={this.handleClick}
                data-test-id="power-learn-more"
              >
                {t('Learn More')}
              </UpsellModalButton>
            </HovercardBody>
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
}

const UpsellModalButton = styled(Button)`
  height: auto;
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
  white-space: pre;
  margin-top: -1px;
  margin-bottom: -1px;
  margin-right: -1px;
  box-shadow: none;
`;

const HovercardBody = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const StyledHovercard = styled(Hovercard)`
  width: auto;
  border-radius: ${p => p.theme.borderRadius};
  .power-icon {
    padding: 0;
    align-items: center;
  }
`;

const Text = styled('span')`
  margin: 10px;
  font-size: 14px;
  white-space: pre;
`;

export default withOrganization(
  withSubscription(PowerFeatureHovercard, {noLoader: true})
);
