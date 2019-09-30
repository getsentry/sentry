import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import video from 'app/../images/congrats-robots/congrats-robots.mp4';

const Message = () => (
  <React.Fragment>
    <h4>{t("We couldn't find any issues that matched your filters.")}</h4>
    <p>{t('Get out there and write some broken code!')}</p>
  </React.Fragment>
);

const CongratsRobots = () => (
  <CongratsRobotsWrapper>
    <AnimatedScene>
      <StyledVideo autoPlay loop muted>
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
  color: ${p => p.theme.gray3};
`;

const AnimatedScene = styled('div')`
  max-width: 800px;
`;

const StyledVideo = styled('video')`
  max-width: 100%;
  margin-bottom: ${space(3)};
`;

export default CongratsRobots;
