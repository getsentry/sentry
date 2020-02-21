import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import video from 'app/../images/spot/congrats-robots.mp4';

const Message = () => (
  <React.Fragment>
    <EmptyMessage>
      {t("We couldn't find any issues that matched your filters.")}
    </EmptyMessage>
    <p>{t('Get out there and write some broken code!')}</p>
  </React.Fragment>
);

const CongratsRobots = () => (
  <CongratsRobotsWrapper>
    <AnimatedScene>
      <StyledVideo autoPlay loop>
        <source src={video} type="video/mp4" />
        {/* Show message if browser doesn't support video */}
        <Message />
      </StyledVideo>
    </AnimatedScene>
    <Message />
  </CongratsRobotsWrapper>
);

const CongratsRobotsWrapper = styled('div')`
  display: flex;
  padding: ${space(4)} ${space(5)};
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: ${p => p.theme.gray3};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

const EmptyMessage = styled('div')`
  font-weight: 600;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    font-size: ${p => p.theme.fontSizeExtraLarge};
  }
`;

const AnimatedScene = styled('div')`
  max-width: 800px;
`;

const StyledVideo = styled('video')`
  max-height: 320px;
  max-width: 100%;
  margin-bottom: ${space(1)};
`;

export default CongratsRobots;
