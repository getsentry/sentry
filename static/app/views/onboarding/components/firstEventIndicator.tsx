import styled from '@emotion/styled';
import type {HTMLMotionProps, Variants} from 'framer-motion';
import {AnimatePresence, motion} from 'framer-motion';

import {LinkButton} from 'sentry/components/button';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {EventWaiterProps} from 'sentry/utils/eventWaiter';
import EventWaiter from 'sentry/utils/eventWaiter';
import testableTransition from 'sentry/utils/testableTransition';

type RenderProps = {
  firstEventButton: React.ReactNode;
  indicator: React.ReactNode;
};

interface FirstEventIndicatorProps extends Omit<EventWaiterProps, 'children' | 'api'> {
  children: (props: RenderProps) => React.ReactNode;
}

function FirstEventIndicator({children, ...props}: FirstEventIndicatorProps) {
  return (
    <EventWaiter {...props}>
      {({firstIssue}) =>
        children({
          indicator: <Indicator firstIssue={firstIssue} {...props} />,
          firstEventButton: (
            <LinkButton
              title={t("You'll need to send your first error to continue")}
              tooltipProps={{disabled: !!firstIssue}}
              disabled={!firstIssue}
              priority="primary"
              onClick={() =>
                trackAnalytics('growth.onboarding_take_to_error', {
                  organization: props.organization,
                  platform: props.project.platform,
                })
              }
              to={`/organizations/${props.organization.slug}/issues/${
                firstIssue && firstIssue !== true && 'id' in firstIssue
                  ? `${firstIssue.id}/`
                  : ''
              }?referrer=onboarding-first-event-indicator`}
            >
              {t('Take me to my error')}
            </LinkButton>
          ),
        })
      }
    </EventWaiter>
  );
}

interface IndicatorProps extends Omit<EventWaiterProps, 'children' | 'api'> {
  firstIssue: null | boolean | Group;
}

function Indicator({firstIssue}: IndicatorProps) {
  return (
    <Container>
      <AnimatePresence>
        {!firstIssue ? <Waiting key="waiting" /> : <Success key="received" />}
      </AnimatePresence>
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  justify-content: right;
`;

const StatusWrapper = styled(motion.div)`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  /* Keep the wrapper in the parent grids first cell for transitions */
  grid-column: 1;
  grid-row: 1;
`;

const StatusWrapperDefaultProps = {
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

function Waiting(props: HTMLMotionProps<'div'>) {
  return (
    <StatusWrapper {...StatusWrapperDefaultProps} {...props}>
      <AnimatedText {...AnimatedTextDefaultProps}>
        {t('Waiting to receive first event to continue')}
      </AnimatedText>
      <WaitingIndicator variants={indicatorAnimation} transition={testableTransition()} />
    </StatusWrapper>
  );
}

function Success(props: HTMLMotionProps<'div'>) {
  return (
    <StatusWrapper {...StatusWrapperDefaultProps} {...props}>
      <AnimatedText {...AnimatedTextDefaultProps}>
        {t('Event was received!')}
      </AnimatedText>
      <ReceivedIndicator size="sm" />
    </StatusWrapper>
  );
}

const indicatorAnimation: Variants = {
  initial: {opacity: 0, y: -10},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 10},
};

const AnimatedText = styled(motion.div)``;

const AnimatedTextDefaultProps = {
  variants: indicatorAnimation,
  transition: testableTransition(),
};

const WaitingIndicator = styled(motion.div)`
  margin: 0 6px;
  ${pulsingIndicatorStyles};
`;

const ReceivedIndicator = styled(IconCheckmark)`
  color: #fff;
  background: ${p => p.theme.green300};
  border-radius: 50%;
  padding: 3px;
  margin: 0 ${space(0.25)};
`;

export {Indicator};

export default FirstEventIndicator;
