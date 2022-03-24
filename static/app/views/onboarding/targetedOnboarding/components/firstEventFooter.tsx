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
import testableTransition from 'sentry/utils/testableTransition';
import CreateSampleEventButton from 'sentry/views/onboarding/createSampleEventButton';

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

  const getSecondaryCta = ({firstIssue}: {firstIssue: null | true | Group}) => {
    // if hasn't sent first event, allow creation of sample error
    if (!hasFirstEvent) {
      return (
        <CreateSampleEventButton
          project={project}
          source="targted-onboarding"
          priority="default"
        >
          {t('View Sample Error')}
        </CreateSampleEventButton>
      );
    }
    // if last, no secondary cta
    if (isLast) {
      return null;
    }
    return (
      <Button
        to={`/organizations/${organization.slug}/issues/${
          firstIssue !== true && firstIssue !== null ? `${firstIssue.id}/` : ''
        }`}
      >
        {t('Take me to my error')}
      </Button>
    );
  };

  const getPrimaryCta = ({firstIssue}: {firstIssue: null | true | Group}) => {
    // if hasn't sent first event, allow skiping
    if (!hasFirstEvent) {
      return (
        <Button priority="primary" onClick={onClickSetupLater}>
          {t('Setup Later')}
        </Button>
      );
    }
    if (isLast) {
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
    }
    return (
      <Button priority="primary" onClick={onClickSetupLater}>
        {t('Next Platform')}
      </Button>
    );
  };

  return (
    <Wrapper>
      <SkipOnboardingLink
        onClick={() =>
          trackAdvancedAnalyticsEvent('growth.onboarding_clicked_skip', {
            organization,
            source,
          })
        }
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
              {getSecondaryCta({firstIssue})}
              {getPrimaryCta({firstIssue})}
            </OnboardingButtonBar>
          </Fragment>
        )}
      </EventWaiter>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  width: 100%;
  position: fixed;
  bottom: 0;
  left: 0;
  height: 72px;
  z-index: 100;
  display: flex;
  background-color: ${p => p.theme.background};
  justify-content: space-between;
  box-shadow: 0px -4px 24px rgba(43, 34, 51, 0.08);
`;

const OnboardingButtonBar = styled(ButtonBar)`
  margin: ${space(2)} ${space(4)};
`;

const AnimatedText = styled(motion.div)<{errorReceived: boolean}>`
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
`;
