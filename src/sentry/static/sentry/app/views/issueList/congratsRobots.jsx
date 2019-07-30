import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import space from 'app/styles/space';
import background from 'app/../images/congrats-robots/background.png';
import main from 'app/../images/congrats-robots/main.json';

const Lottie = React.lazy(() =>
  import(/* webpackChunkName: "ReactLottie" */ 'react-lottie')
);

const CongratsRobots = () => {
  return (
    <React.Suspense fallback={null}>
      <CongratsRobotsWrapper>
        <AnimatedScene>
          <StyledImage src={background} />
          <StyledLottie>
            <Lottie
              options={{animationData: main}}
              ariaRole={null}
              isClickToPauseDisabled
            />
          </StyledLottie>
        </AnimatedScene>
        <Description>
          {t(
            "Congrats, we couldn't find any errors that matched your filters. Get out there and write some broken code!"
          )}
        </Description>
      </CongratsRobotsWrapper>
    </React.Suspense>
  );
};

const CongratsRobotsWrapper = styled('div')`
  display: grid;
  grid-template-rows: auto auto;
  margin: ${space(3)};
  grid-gap: ${space(3)};
`;

const AnimatedScene = styled('div')`
  display: inline-grid;
  grid-template-columns: auto;
  justify-self: center;
`;

const StyledImage = styled('img')`
  grid-column: 1 / 2;
  grid-row: 1 / 2;
`;

const StyledLottie = styled('div')`
  grid-column: 1 / 2;
  grid-row: 1 / 2;
`;

const Description = styled('div')`
  justify-self: center;
`;

export default CongratsRobots;
