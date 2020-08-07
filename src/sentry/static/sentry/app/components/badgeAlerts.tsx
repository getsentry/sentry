import {AnimatePresence, motion} from 'framer-motion';
import React from 'react';
import styled from '@emotion/styled';
import {observer} from 'mobx-react';
import Confetti from 'react-dom-confetti';

import {activeAlerts} from 'app/actionCreators/badges';
import space from 'app/styles/space';
import {Badge} from 'app/types';
import Unlock from 'app/views/badges/icons/unlock';
import Banner from 'app/views/badges/icons/banner';

const confettiConfig = {
  angle: 90,
  spread: 140,
  startVelocity: 12,
  elementCount: 70,
  dragFriction: 0.03,
  duration: 6000,
  stagger: 3,
  width: '6px',
  height: '14px',
  perspective: '500px',
  colors: ['#a864fd', '#FA4747', '#FFC227', ';#4DC771', '#3D74DB'],
};

const BadgeAlerts = observer(() => {
  return (
    <Container>
      <AnimatePresence>
        {activeAlerts
          .slice()
          .reverse()
          .map(alert => (
            <Alert key={alert.id} badge={alert.badge} />
          ))}
      </AnimatePresence>
    </Container>
  );
});

const Alert = ({badge}: {badge: Badge}) => {
  // eslint-disable-next-line sentry/no-react-hooks
  const [showCofetti, setShowConfetti] = React.useState(false);
  // eslint-disable-next-line sentry/no-react-hooks
  const [banner] = React.useState(Math.ceil(Math.random() * 2));

  return (
    <BadgeFrame
      positionTransition
      onAnimationStart={() => setTimeout(() => setShowConfetti(true), 1500)}
    >
      <Icon>
        <UnlockMotion>
          <Unlock />
        </UnlockMotion>
        <BadgeMotion>
          <badge.icon />
        </BadgeMotion>
        <Confetti active={showCofetti} config={confettiConfig} />
      </Icon>
      <Banner select={banner}>
        <Text>{badge.title}</Text>
      </Banner>
    </BadgeFrame>
  );
};

const Container = styled('div')`
  position: fixed;
  left: 0;
  right: 0;
  align-items: center;
  flex-direction: column;
  gap: ${space(4)};
  display: flex;
  bottom: 100px;
  z-index: ${p => p.theme.zIndex.toast};
`;

const BadgeFrame = styled(motion.div)`
  width: 225px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Text = styled('div')`
  font-size: 17px;
  font-weight: 700;
  color: ${p => p.theme.gray700};
`;

const Icon = styled('div')`
  display: grid;
  align-items: center;
  justify-items: center;
  width: 160px;
  margin-bottom: -${space(4)};

  > * {
    grid-column: 1;
    grid-row: 1;
  }

  svg {
    width: 100%;
    position: relative;
    z-index: 2;
  }
`;

BadgeFrame.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {
    initial: {opacity: 0},
    animate: {opacity: 1, y: 0},
    exit: {opacity: 0, scale: 0.5},
  },
  transition: {
    duration: 0.4,
    y: {
      type: 'spring',
      damping: 18,
      stiffness: 300,
    },
    scale: {
      type: 'spring',
      damping: 30,
      stiffness: 600,
    },
  },
};

const UnlockMotion = styled(motion.div)``;

UnlockMotion.defaultProps = {
  variants: {
    initial: {opacity: 1, scale: 1, originX: '50%', originY: '50%'},
    animate: {
      opacity: 0,
      scale: 0.4,
    },
  },
  transition: {
    delay: 1.5,
    scale: {
      type: 'spring',
      damping: 15,
      stiffness: 500,
    },
  },
};

const BadgeMotion = styled(motion.div)``;

BadgeMotion.defaultProps = {
  variants: {
    initial: {opacity: 0, scale: 0.6, originX: '50%', originY: '50%'},
    animate: {
      opacity: 1,
      scale: 1,
    },
  },
  transition: {
    delay: 1.5,
    scale: {
      type: 'spring',
      damping: 10,
      stiffness: 500,
    },
  },
};

export default BadgeAlerts;
