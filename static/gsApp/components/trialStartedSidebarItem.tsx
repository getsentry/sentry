import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import type {Client} from 'sentry/api';
import {Hovercard} from 'sentry/components/hovercard';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
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
  className?: string;
};

function TrialStartedSidebarItem({subscription, organization, children}: Props) {
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
  // Dismiss trial started when user clicks outside of trial requested or started hovercard
  const hovercardBodyRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(hovercardBodyRef, dismissNotification);

  const renderTrialStartedHovercardBody = () => {
    return (
      <HovercardBody ref={hovercardBodyRef}>
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

        <Flex justify="end">
          <Button onClick={dismissNotification} size="xs">
            {t('Awesome, got it!')}
          </Button>
        </Flex>
      </HovercardBody>
    );
  };

  const renderTrialRequestedHovercardBody = () => {
    return (
      <HovercardBody ref={hovercardBodyRef}>
        <HovercardHeader>{t('Trial Requested')}</HovercardHeader>
        <p>
          {t(
            'We have notified your organization owner that you want to start a Sentry trial.'
          )}
        </p>

        <Flex justify="end">
          <Button onClick={dismissNotification} size="xs">
            {t('Awesome, got it!')}
          </Button>
        </Flex>
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

  if (hasJustStartedPlanTrial(subscription)) {
    return <Fragment>{renderWithHovercard(renderTrialStartedHovercardBody())}</Fragment>;
  }

  if (trialRequested) {
    return (
      <Fragment>{renderWithHovercard(renderTrialRequestedHovercardBody())}</Fragment>
    );
  }

  return <Fragment>{children}</Fragment>;
}

// We specifically set the z-index lower than the modal here, since it will be
// common to start a trial with the upsell modal open.
const StyledHovercard = styled(Hovercard)`
  width: 310px;
  z-index: ${p => p.theme.zIndex.modal - 1};
`;

const HovercardBody = styled('div')`
  h1 {
    font-size: ${p => p.theme.font.size.lg};
    margin-bottom: ${p => p.theme.space.lg};
  }
  p {
    font-size: ${p => p.theme.font.size.md};
  }
`;

const Bullets = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-auto-rows: max-content;
  gap: ${p => p.theme.space.md};
  align-items: center;
  font-size: ${p => p.theme.font.size.md};
  margin-bottom: ${p => p.theme.space.xl};
`;

const HovercardHeader = styled('h1')`
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: center;
`;

export default withApi(TrialStartedSidebarItem);
