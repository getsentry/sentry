import {useEffect, useState} from 'react';
import type {Theme} from '@emotion/react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import ProgressRing from 'sentry/components/progressRing';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

import MoreFeaturesLink from 'getsentry/views/amCheckout/moreFeaturesLink';

import type {Feature} from './types';

type Props = {
  features: Feature[];
  onClick: (feat: Feature) => void;
  shouldShowPerformanceFeatures: boolean;
  shouldShowTeamFeatures: boolean;
  selected?: Feature;
  withCountdown?: number;
};

function FeatureList({
  features,
  selected,
  onClick,
  withCountdown,
  shouldShowTeamFeatures,
  shouldShowPerformanceFeatures,
}: Props) {
  return (
    <div>
      <Heading>
        {shouldShowPerformanceFeatures
          ? t('Features Include')
          : shouldShowTeamFeatures
            ? t('Features Include')
            : t('Business Features Include')}
        <AnimatePresence>
          {selected && withCountdown && (
            <CountdownRing id={selected.id} totalTime={withCountdown} />
          )}
        </AnimatePresence>
      </Heading>
      {features.map(feat => (
        <FeatureLink
          key={feat.id}
          onClick={() => onClick(feat)}
          aria-selected={feat === selected ? true : undefined}
          data-test-id={feat.id}
        >
          <IconBusiness gradient={feat === selected} withShine={feat === selected} />
          {feat.name}
        </FeatureLink>
      ))}
      <MoreFeaturesLink />
    </div>
  );
}

type CountdownRingProps = {
  id: string;
  theme: Theme;
  totalTime: number;
};

/**
 * Countdown ring is used to show a countdown ring to the right of the header
 * when in 'auto rotate' carousel mode
 */
const CountdownRing = withTheme(({theme, id, totalTime}: CountdownRingProps) => {
  const [timeLeft, setTimeLeft] = useState(totalTime);
  const tick = 200;

  useEffect(() => {
    if (timeLeft <= 0) {
      return () => void 0;
    }

    const intervalId = setInterval(() => setTimeLeft(timeLeft - tick), tick);
    return () => clearInterval(intervalId);
  }, [timeLeft]);

  // Reset time left when id changes
  useEffect(() => void setTimeLeft(totalTime), [id, totalTime]);

  return (
    <RingContainer animate={{opacity: 1}} initial={{opacity: 0}} exit={{opacity: 0}}>
      <ProgressRing
        maxValue={totalTime}
        value={timeLeft}
        barWidth={2}
        size={14}
        backgroundColor={theme.gray100}
        progressColor={theme.gray200}
      />
    </RingContainer>
  );
});

const RingContainer = styled(motion.div)`
  display: flex;
  align-items: center;
`;

const Heading = styled('div')`
  font-weight: bold;
  margin-bottom: ${space(1)};
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(0.5)};
`;

const FeatureLink = styled(motion.div)`
  cursor: pointer;
  transition: color 300ms;
  color: ${p => p.theme.gray300};
  position: relative;
  display: grid;
  grid-template-columns: max-content auto;
  gap: ${space(1)};
  align-items: center;
  align-content: center;
  margin-bottom: ${space(0.5)};

  &:hover {
    color: ${p => p.theme.textColor};
  }
  &[aria-selected] {
    color: ${p => p.theme.textColor};
    font-weight: bold;
  }
`;

FeatureLink.defaultProps = {
  whileTap: {x: -7},
  transition: testableTransition(),
};

export default FeatureList;
