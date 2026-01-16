import {useEffect, useMemo, useState} from 'react';
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

function TrialStartedSidebarItem({
  className,
  theme,
  subscription,
  organization,
  children,
}: Props) {
  const [animationComplete, setAnimationComplete] = useState<boolean>(
    !!hasJustStartedPlanTrial(subscription)
  );
  const [trialRequested, setTrialRequested] = useState<boolean>(
    TrialRequestedStore.getTrialRequstedState()
  );

  useEffect(() => {
    const unsubscribe = TrialRequestedStore.listen(
      () => setTrialRequested(TrialRequestedStore.getTrialRequstedState()),
      undefined
    );
    return () => {
      unsubscribe();
    };
  }, []);

  const dismissNotification = () => {
    SubscriptionStore.clearStartedTrial(organization.slug);
    TrialRequestedActions.clearNotification();
  };

  const renderTrialStartedHovercardBody = () => {
    return (
      <HovercardBody>
        <HovercardHeader>
          <div>{t('Trial Started')}</div>
          <TrialBadge subscription={subscription} organization={organization} />
        </HovercardHeader>
        <p>{t('Check out these great new features')}</p>

        <Bullets>
          <IconBusiness />
          {t('Application Insights')}
          <IconBusiness />
          {t('Dashboards')}
          <IconBusiness />
          {t('Advanced Discover Queries')}
          <IconBusiness />
          {t('Additional Integrations')}
        </Bullets>

        <Button onClick={dismissNotification} size="xs">
          {t('Awesome, got it!')}
        </Button>
      </HovercardBody>
    );
  };

  const renderTrialRequestedHovercardBody = () => {
    return (
      <HovercardBody>
        <HovercardHeader>{t('Trial Requested')}</HovercardHeader>
        <p>
          {t(
            'We have notified your organization owner that you want to start a Sentry trial.'
          )}
        </p>

        <Button onClick={dismissNotification} size="xs">
          {t('Awesome, got it!')}
        </Button>
      </HovercardBody>
    );
  };

  const renderWithHovercard = (hovercardBody: React.ReactNode) => {
    return (
      <StyledHovercard forceVisible position="right" body={hovercardBody}>
        {children}
      </StyledHovercard>
    );
  };

  const trialRequestedOrStarted = useMemo(() => {
    return hasJustStartedPlanTrial(subscription) || trialRequested;
  }, [subscription, trialRequested]);

  const animate =
    animationComplete && !trialRequestedOrStarted
      ? 'dismissed'
      : trialRequestedOrStarted
        ? 'started'
        : 'initial';

  let wrappedChildren = children;

  if (animationComplete) {
    if (hasJustStartedPlanTrial(subscription)) {
      wrappedChildren = renderWithHovercard(renderTrialStartedHovercardBody());
    } else if (trialRequested) {
      wrappedChildren = renderWithHovercard(renderTrialRequestedHovercardBody());
    }
  }

  return (
    <Wrapper
      className={className}
      initial={animate}
      onAnimationComplete={() => setTimeout(() => setAnimationComplete(true), 500)}
      animate={animate}
      variants={{
        initial: {
          backgroundImage: `linear-gradient(-45deg, ${theme.tokens.background.accent.vibrant} 0%, transparent 0%)`,
        },
        started: {
          backgroundImage: `linear-gradient(-45deg, ${theme.tokens.background.accent.vibrant} 100%, transparent 0%)`,

          // We flip the gradient direction so that on dismiss we can animate in the
          // opposite direction.
          transitionEnd: {
            backgroundImage: `linear-gradient(45deg, ${theme.tokens.background.accent.vibrant} 100%, transparent 0%)`,
          },

          color: theme.colors.white,

          transition: testableTransition({
            duration: 0.35,
            delay: 1,
          }),
        },
        dismissed: {
          backgroundImage: `linear-gradient(-45deg, ${theme.tokens.background.accent.vibrant} 0%, transparent 0%)`,
        },
      }}
    >
      {wrappedChildren}
    </Wrapper>
  );
}

const startedStyle = (theme: Theme) => css`
  transition: box-shadow 200ms;

  button,
  button:hover {
    color: inherit;
  }

  &:hover a {
    color: ${theme.colors.white};
  }

  &:hover {
    box-shadow: 0 0 8px ${theme.tokens.background.accent.vibrant};
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

// We specifically set the z-index lower than the modal here, since it will be
// common to start a trial with the upsell modal open.
const StyledHovercard = styled(Hovercard)`
  width: 310px;
  z-index: ${p => p.theme.zIndex.modal - 1};
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
