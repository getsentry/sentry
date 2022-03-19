import styled from '@emotion/styled';
import {motion, Variants} from 'framer-motion';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import EventWaiter from 'sentry/utils/eventWaiter';
import testableTransition from 'sentry/utils/testableTransition';
import CreateSampleEventButton from 'sentry/views/onboarding/createSampleEventButton';

interface FirstEventFooterProps {
  onClickSetupLater: () => void;
  organization: Organization;
  project: Project;
}

export default function FirstEventFooter({
  organization,
  project,
  onClickSetupLater,
}: FirstEventFooterProps) {
  return (
    <Wrapper>
      <EventWaiter eventType="error" {...{project, organization}}>
        {({firstIssue: _firstIssue}) => (
          <StatusWrapper>
            <WaitingIndicator />
            <AnimatedText>{t('Waiting for error')}</AnimatedText>
          </StatusWrapper>
        )}
      </EventWaiter>
      <OnboardingButtonBar gap={2}>
        <CreateSampleEventButton
          project={project}
          source="targted-onboarding"
          priority="default"
        >
          {t('View Sample Error')}
        </CreateSampleEventButton>
        <Button priority="primary" onClick={onClickSetupLater}>
          {t('Setup Later')}
        </Button>
      </OnboardingButtonBar>
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
  background-color: ${p => p.theme.white};
  justify-content: center;
`;

const OnboardingButtonBar = styled(ButtonBar)`
  margin: ${space(2)} ${space(4)};
  right: 0;
  bottom: 0;
  position: fixed;
`;

const AnimatedText = styled(motion.div)`
  margin-left: ${space(1)};
  color: ${p => p.theme.charts.getColorPalette(5)[4]};
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
