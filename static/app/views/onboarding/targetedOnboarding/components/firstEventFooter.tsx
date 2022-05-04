import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion, Variants} from 'framer-motion';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Link from 'sentry/components/links/link';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventWaiter from 'sentry/utils/eventWaiter';
import isMobile from 'sentry/utils/isMobile';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import CreateSampleEventButton from 'sentry/views/onboarding/createSampleEventButton';

import {usePersistedOnboardingState} from '../utils';

import GenericFooter from './genericFooter';

interface FirstEventFooterProps {
  handleFirstIssueReceived: () => void;
  hasFirstEvent: boolean;
  isLast: boolean;
  onClickSetupLater: () => void;
  organization: Organization;
  project: Project;
}

export default function FirstEventFooter({
  organization,
  project,
  onClickSetupLater,
  isLast,
  hasFirstEvent,
  handleFirstIssueReceived,
}: FirstEventFooterProps) {
  const source = 'targeted_onboarding_first_event_footer';
  const [clientState, setClientState] = usePersistedOnboardingState();
  const client = useApi();

  const getSecondaryCta = () => {
    if (
      isMobile() &&
      organization.experiments.TargetedOnboardingMobileRedirectExperiment === 'email-cta'
    ) {
      return (
        <Button
          to={`/onboarding/${organization.slug}/mobile-redirect/`}
          onClick={() => {
            clientState &&
              client.requestPromise(
                `/organizations/${organization.slug}/onboarding-continuation-email/`,
                {
                  method: 'POST',
                  data: {
                    platforms: clientState.selectedPlatforms,
                  },
                }
              );
          }}
        >
          {t('Do it Later')}
        </Button>
      );
    }
    // if hasn't sent first event, allow skiping.
    // if last, no secondary cta
    if (!hasFirstEvent && !isLast) {
      return <Button onClick={onClickSetupLater}>{t('Next Platform')}</Button>;
    }
    return null;
  };

  const getPrimaryCta = ({firstIssue}: {firstIssue: null | true | Group}) => {
    // if hasn't sent first event, allow creation of sample error
    if (!hasFirstEvent) {
      return (
        <StyledCreateSampleEventButton
          project={project}
          source="targted-onboarding"
          priority="primary"
        >
          {t('View Sample Error')}
        </StyledCreateSampleEventButton>
      );
    }

    return (
      <Button
        to={`/organizations/${organization.slug}/issues/${
          firstIssue !== true && firstIssue !== null ? `${firstIssue.id}/` : ''
        }`}
        priority="primary"
      >
        {t('Take me to my error')}
      </Button>
    );
  };

  return (
    <GridFooter>
      <SkipOnboardingLink
        onClick={() => {
          trackAdvancedAnalyticsEvent('growth.onboarding_clicked_skip', {
            organization,
            source,
          });
          if (clientState) {
            setClientState({
              ...clientState,
              state: 'skipped',
            });
          }
        }}
        to={`/organizations/${organization.slug}/issues/`}
      >
        {t('Skip Onboarding')}
      </SkipOnboardingLink>
      <EventWaiter
        eventType="error"
        onIssueReceived={handleFirstIssueReceived}
        {...{project, organization}}
      >
        {({firstIssue}) => (
          <Fragment>
            <StatusWrapper>
              {hasFirstEvent ? (
                <IconCheckmark isCircled color="green400" />
              ) : (
                <WaitingIndicator />
              )}
              <AnimatedText errorReceived={hasFirstEvent}>
                {hasFirstEvent ? t('Error Received') : t('Waiting for error')}
              </AnimatedText>
            </StatusWrapper>
            <OnboardingButtonBar gap={2}>
              {getSecondaryCta()}
              {getPrimaryCta({firstIssue})}
            </OnboardingButtonBar>
          </Fragment>
        )}
      </EventWaiter>
    </GridFooter>
  );
}

const OnboardingButtonBar = styled(ButtonBar)`
  margin: ${space(2)} ${space(4)};
  justify-self: end;
`;

const AnimatedText = styled(motion.div, {
  shouldForwardProp: prop => prop !== 'errorReceived',
})<{errorReceived: boolean}>`
  margin-left: ${space(1)};
  color: ${p =>
    p.errorReceived ? p.theme.successText : p.theme.charts.getColorPalette(5)[4]};
`;

const indicatorAnimation: Variants = {
  initial: {opacity: 0, y: -10},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 10},
};

AnimatedText.defaultProps = {
  variants: indicatorAnimation,
  transition: testableTransition(),
};

const WaitingIndicator = styled(motion.div)`
  ${pulsingIndicatorStyles};
  background-color: ${p => p.theme.charts.getColorPalette(5)[4]};
`;

WaitingIndicator.defaultProps = {
  variants: indicatorAnimation,
  transition: testableTransition(),
};

const StatusWrapper = styled(motion.div)`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  justify-content: center;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

StatusWrapper.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {
    initial: {opacity: 0, y: -10},
    animate: {
      opacity: 1,
      y: 0,
      transition: testableTransition({when: 'beforeChildren', staggerChildren: 0.35}),
    },
    exit: {opacity: 0, y: 10},
  },
};

const SkipOnboardingLink = styled(Link)`
  margin: auto ${space(4)};
  white-space: nowrap;
`;

const GridFooter = styled(GenericFooter)`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr 1fr;
  }
`;

const StyledCreateSampleEventButton = styled(CreateSampleEventButton)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;
