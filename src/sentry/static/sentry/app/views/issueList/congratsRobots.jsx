import Lottie from 'react-lottie';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import space from 'app/styles/space';
import background from 'app/../images/spot/congrats-background.png';
import main from 'app/../images/spot/congrats-robot.json';

const CongratsRobots = () => {
  return (
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
        <SearchResults>
          {t("We couldn't find any issues that matched your filters.")}
        </SearchResults>
        <MoreIssues>{t('Get out there and write some broken code!')}</MoreIssues>
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
  display: grid;
  color: ${p => p.theme.gray3};
`;

const SearchResults = styled('div')`
  font-size: 18px;
  justify-self: center;
`;

const MoreIssues = styled('div')`
  justify-self: center;
`;

export default CongratsRobots;
