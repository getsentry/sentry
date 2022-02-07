import * as React from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, Variants} from 'framer-motion';

import Button from 'sentry/components/button';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';
import {Group} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventWaiter from 'sentry/utils/eventWaiter';
import testableTransition from 'sentry/utils/testableTransition';

type EventWaiterProps = Omit<React.ComponentProps<typeof EventWaiter>, 'children'>;
type FirstIssue = null | true | Group;

type RenderProps = {
  firstEventButton: React.ReactNode;
  indicator: React.ReactNode;
};

type Props = EventWaiterProps & {
  children: (props: RenderProps) => React.ReactNode;
};

const FirstEventIndicator = ({children, ...props}: Props) => (
  <EventWaiter {...props}>
    {({firstIssue}) =>
      children({
        indicator: <Indicator firstIssue={firstIssue} {...props} />,
        firstEventButton: (
          <Button
            title={t("You'll need to send your first error to continue")}
            tooltipProps={{disabled: !!firstIssue}}
            disabled={!firstIssue}
            priority="primary"
            onClick={() =>
              trackAdvancedAnalyticsEvent('growth.onboarding_take_to_error', {
                organization: props.organization,
              })
            }
            to={`/organizations/${props.organization.slug}/issues/${
              firstIssue !== true && firstIssue !== null ? `${firstIssue.id}/` : ''
            }`}
          >
            {t('Take me to my error')}
          </Button>
        ),
      })
    }
  </EventWaiter>
);

const Indicator = ({firstIssue}: EventWaiterProps & {firstIssue: FirstIssue}) => (
  <Container>
    <AnimatePresence>
      {!firstIssue ? <Waiting key="waiting" /> : <Success key="received" />}
    </AnimatePresence>
  </Container>
);

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

const Waiting = (props: React.ComponentProps<typeof StatusWrapper>) => (
  <StatusWrapper {...props}>
    <AnimatedText>{t('Waiting to receive first event to continue')}</AnimatedText>
    <WaitingIndicator />
  </StatusWrapper>
);

const Success = (props: React.ComponentProps<typeof StatusWrapper>) => (
  <StatusWrapper {...props}>
    <AnimatedText>{t('Event was received!')}</AnimatedText>
    <ReceivedIndicator />
  </StatusWrapper>
);

const indicatorAnimation: Variants = {
  initial: {opacity: 0, y: -10},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 10},
};

const AnimatedText = styled(motion.div)``;

AnimatedText.defaultProps = {
  variants: indicatorAnimation,
  transition: testableTransition(),
};

const WaitingIndicator = styled(motion.div)`
  margin: 0 6px;
  ${pulsingIndicatorStyles};
`;

WaitingIndicator.defaultProps = {
  variants: indicatorAnimation,
  transition: testableTransition(),
};

const ReceivedIndicator = styled(IconCheckmark)`
  color: #fff;
  background: ${p => p.theme.green300};
  border-radius: 50%;
  padding: 3px;
  margin: 0 ${space(0.25)};
`;

ReceivedIndicator.defaultProps = {
  size: 'sm',
};

export {Indicator};

export default FirstEventIndicator;
