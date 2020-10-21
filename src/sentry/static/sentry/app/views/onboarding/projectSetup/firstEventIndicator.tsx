import * as React from 'react';
import {motion, AnimatePresence, Variants} from 'framer-motion';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Button from 'app/components/button';
import EventWaiter from 'app/utils/eventWaiter';
import space from 'app/styles/space';
import pulsingIndicatorStyles from 'app/styles/pulsingIndicator';
import {Group, Organization} from 'app/types';
import {IconCheckmark} from 'app/icons';
import testableTransition from 'app/utils/testableTransition';

type EventWaiterProps = Omit<React.ComponentProps<typeof EventWaiter>, 'children'>;
type FirstIssue = null | true | Group;

const FirstEventIndicator = (props: EventWaiterProps) => (
  <EventWaiter {...props}>
    {({firstIssue}) => <Indicator firstIssue={firstIssue} {...props} />}
  </EventWaiter>
);

const Indicator = ({
  firstIssue,
  ...props
}: EventWaiterProps & {firstIssue: FirstIssue}) => (
  <AnimatePresence>
    {!firstIssue ? (
      <Waiting key="waiting" />
    ) : (
      <Success key="received" firstIssue={firstIssue} {...props} />
    )}
  </AnimatePresence>
);

const StatusWrapper = styled(motion.div)`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-gap: ${space(1)};
  align-items: center;
  font-size: 0.9em;
  /* This is a minor hack, but the line height is just *slightly* too low,
  making the text appear off center, so we adjust it just a bit */
  line-height: calc(0.9em + 1px);
  /* Ensure the event waiter status is always the height of a button */
  height: ${space(4)};
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
    <WaitingIndicator />
    <AnimatedText>{t('Waiting for verification event')}</AnimatedText>
  </StatusWrapper>
);

type SuccessProps = EventWaiterProps & {
  firstIssue: FirstIssue;
  organization: Organization;
};

const Success = ({organization, firstIssue, ...props}: SuccessProps) => (
  <StatusWrapper {...props}>
    <ReceivedIndicator />
    <AnimatedText>{t('Event was received!')}</AnimatedText>
    {firstIssue && firstIssue !== true && (
      <EventAction>
        <Button
          size="small"
          priority="primary"
          to={`/organizations/${organization.slug}/issues/${firstIssue.id}/`}
        >
          {t('Take me to my event')}
        </Button>
      </EventAction>
    )}
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
  background: ${p => p.theme.green400};
  border-radius: 50%;
  padding: 5px;
  margin: 0 2px;
`;

ReceivedIndicator.defaultProps = {
  size: 'sm',
};

const EventAction = styled(motion.div)``;

EventAction.defaultProps = {
  variants: {
    initial: {x: -20, opacity: 0},
    animate: {x: 0, opacity: 1},
  },
  transition: testableTransition(),
};

export {Indicator};

export default FirstEventIndicator;
