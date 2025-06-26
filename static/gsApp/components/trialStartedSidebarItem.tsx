import {Component} from 'react';
import type {Theme} from '@emotion/react';
import {css, withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/core/button';
import {Hovercard} from 'sentry/components/hovercard';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import testableTransition from 'sentry/utils/testableTransition';
import withApi from 'sentry/utils/withApi';
import {prefersStackedNav} from 'sentry/views/nav/prefersStackedNav';

import TrialRequestedActions from 'getsentry/actions/trialRequestedActions';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import TrialRequestedStore from 'getsentry/stores/trialRequestedStore';
import type {Subscription} from 'getsentry/types';
import {hasJustStartedPlanTrial} from 'getsentry/utils/billing';
import TrialBadge from 'getsentry/views/subscriptionPage/trial/badge';

type Props = {
  api: Client;
  children: React.ReactNode;
  organization: Organization;
  subscription: Subscription;
  theme: Theme;
  className?: string;
};

type State = {
  animationComplete: boolean;
  trialRequested: boolean;
};

class TrialStartedSidebarItem extends Component<Props, State> {
  state: State = {
    animationComplete: !!hasJustStartedPlanTrial(this.props.subscription),
    trialRequested: TrialRequestedStore.getTrialRequstedState(),
  };

  componentWillUnmount() {
    this.unsubscribe();
  }

  unsubscribe = TrialRequestedStore.listen(
    () => this.setState({trialRequested: TrialRequestedStore.getTrialRequstedState()}),
    undefined
  );

  dismissNotification = () => {
    SubscriptionStore.clearStartedTrial(this.props.organization.slug);
    TrialRequestedActions.clearNotification();
  };

  renderTrialStartedHovercardBody() {
    return (
      <HovercardBody>
        <HovercardHeader>
          <div>{t('Trial Started')}</div>
          <TrialBadge
            subscription={this.props.subscription}
            organization={this.props.organization}
          />
        </HovercardHeader>
        <p>{t('Check out these great new features')}</p>

        <Bullets>
          <IconBusiness gradient />
          {t('Application Insights')}
          <IconBusiness gradient />
          {t('Dashboards')}
          <IconBusiness gradient />
          {t('Advanced Discover Queries')}
          <IconBusiness gradient />
          {t('Additional Integrations')}
        </Bullets>

        <Button onClick={this.dismissNotification} size="xs">
          {t('Awesome, got it!')}
        </Button>
      </HovercardBody>
    );
  }

  renderTrialRequestedHovercardBody() {
    return (
      <HovercardBody>
        <HovercardHeader>{t('Trial Requested')}</HovercardHeader>
        <p>
          {t(
            'We have notified your organization owner that you want to start a Sentry trial.'
          )}
        </p>

        <Button onClick={this.dismissNotification} size="xs">
          {t('Awesome, got it!')}
        </Button>
      </HovercardBody>
    );
  }

  renderWithHovercard(hovercardBody: React.ReactNode) {
    const prefersNewNav = prefersStackedNav(this.props.organization);

    return (
      <StyledHovercard
        forceVisible
        position="right"
        body={hovercardBody}
        prefersNewNav={prefersNewNav}
      >
        {this.props.children}
      </StyledHovercard>
    );
  }

  get trialRequestedOrStarted() {
    const {trialRequested} = this.state;
    return hasJustStartedPlanTrial(this.props.subscription) || trialRequested;
  }

  render() {
    const {animationComplete, trialRequested} = this.state;
    const {className, theme} = this.props;

    const animate =
      animationComplete && !this.trialRequestedOrStarted
        ? 'dismissed'
        : this.trialRequestedOrStarted
          ? 'started'
          : 'initial';

    let children = this.props.children;

    if (animationComplete) {
      if (hasJustStartedPlanTrial(this.props.subscription)) {
        children = this.renderWithHovercard(this.renderTrialStartedHovercardBody());
      } else if (trialRequested) {
        children = this.renderWithHovercard(this.renderTrialRequestedHovercardBody());
      }
    }

    const prefersNewNav = prefersStackedNav(this.props.organization);

    const content = (
      <Wrapper
        className={className}
        initial={animate}
        onAnimationComplete={() =>
          setTimeout(() => this.setState({animationComplete: true}), 500)
        }
        animate={animate}
        variants={{
          initial: {
            backgroundImage: `linear-gradient(-45deg, ${theme.purple400} 0%, transparent 0%)`,
          },
          started: {
            backgroundImage: `linear-gradient(-45deg, ${theme.purple400} 100%, transparent 0%)`,

            // We flip the gradient direction so that on dismiss we can animate in the
            // opposite direction.
            transitionEnd: {
              backgroundImage: `linear-gradient(45deg, ${theme.purple400} 100%, transparent 0%)`,
            },

            color: theme.button.primary.color,

            transition: testableTransition({
              duration: 0.35,
              delay: 1,
            }),
          },
          dismissed: {
            backgroundImage: `linear-gradient(-45deg, ${theme.purple400} 0%, transparent 0%)`,
          },
        }}
      >
        {children}
      </Wrapper>
    );

    if (prefersNewNav) {
      return content;
    }

    return <BoxShadowHider>{content}</BoxShadowHider>;
  }
}

const startedStyle = (theme: Theme) => css`
  transition: box-shadow 200ms;

  button,
  button:hover {
    color: inherit;
  }

  &:hover a {
    color: ${theme.button.primary.color};
  }

  &:hover {
    box-shadow: 0 0 8px ${theme.purple400};
  }
`;

const Wrapper = styled(motion.div)`
  margin: 0 -20px 0 -5px;
  padding: 0 20px 0 5px;
  border-radius: 4px 0 0 4px;
  ${p => p.animate === 'started' && startedStyle(p.theme)}

  /* This is needed to fix positioning of the hovercard, since it wraps a
   * inline span, the span has no size and the position is incorrectly
   * computed, causing the hovercard to appear far from the nav item */
  span[aria-describedby] {
    display: block;
  }
`;

const BoxShadowHider = styled('div')`
  margin: -20px;
  padding: 20px;
  overflow: hidden;
`;

// We specifically set the z-index lower than the modal here, since it will be
// common to start a trial with the upsell modal open.
const StyledHovercard = styled(Hovercard)<{prefersNewNav: boolean}>`
  width: 310px;
  z-index: ${p => p.theme.zIndex.modal - 1};
  ${p =>
    !p.prefersNewNav &&
    css`
      margin-left: 30px;
    `}
`;

const HovercardBody = styled('div')`
  h1 {
    font-size: ${p => p.theme.fontSize.lg};
    margin-bottom: ${space(1.5)};
  }
  p {
    font-size: ${p => p.theme.fontSize.md};
  }
`;

const Bullets = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-auto-rows: max-content;
  gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSize.md};
  margin-bottom: ${space(2)};
`;

const HovercardHeader = styled('h1')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

export default withApi(withTheme(TrialStartedSidebarItem));
