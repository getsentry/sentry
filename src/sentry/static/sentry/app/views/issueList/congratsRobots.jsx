import Lottie from 'react-lottie';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import space from 'app/styles/space';
import backwall from 'app/../images/congrats-robots/backwall.png';
import banner from 'app/../images/congrats-robots/banner.png';
import confetti_1 from 'app/../images/congrats-robots/confetti_1.json';
import confetti_2 from 'app/../images/congrats-robots/confetti_2.json';
import confetti_bg from 'app/../images/congrats-robots/confetti_bg.json';
import main from 'app/../images/congrats-robots/main.json';
import rug from 'app/../images/congrats-robots/rug.png';

const CongratsRobots = () => {
  return (
    <CongratsRobotsWrapper>
      <AnimatedScene>
        <StyledImage src={backwall} />
        <StyledImage src={banner} />
        <StyledImage src={rug} />
        <StyledLottie>
          <Lottie
            options={{animationData: main}}
            ariaRole={null}
            isClickToPauseDisabled
          />
        </StyledLottie>
        <StyledLottie>
          <Lottie
            options={{animationData: confetti_1}}
            ariaRole={null}
            isClickToPauseDisabled
          />
        </StyledLottie>
        <StyledLottie>
          <Lottie
            options={{animationData: confetti_2}}
            ariaRole={null}
            isClickToPauseDisabled
          />
        </StyledLottie>
        <StyledLottie>
          <Lottie
            options={{animationData: confetti_bg}}
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
